import { createClerkClient } from "@clerk/backend";
import { officialMenuContext, restaurantKnowledge } from "./chatbot/knowledge.ts";
import { getChatbotReply, getManualReply } from "./chatbot/reply.ts";

type WorkerMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const TEST_CLERK_CLIENT = Symbol("test-clerk-client");
type ClerkEmailAddress = { id: string; emailAddress: string; verification?: { status?: string } | null };
type ClerkUserRecord = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddressId?: string | null;
  emailAddresses: ClerkEmailAddress[];
};
type ClerkClientLike = {
  authenticateRequest(request: Request, options: { authorizedParties: string[] }): Promise<{
    isAuthenticated: boolean;
    toAuth(): { userId: string | null };
  }>;
  users: { getUser(userId: string): Promise<ClerkUserRecord> };
};

interface Env {
  [TEST_AUTH_BYPASS]?: true;
  AI: {
    run(model: string, input: { messages: WorkerMessage[] }): Promise<unknown>;
  };
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  CHAT_RATE_LIMIT: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
  ORDER_RATE_LIMIT: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
  DB: OrderDatabaseBinding;
  AUTH_RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
  AUTH_EMAIL_RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
  STAFF_EMAIL?: string;
  STAFF_PASSWORD_HASH?: string;
  STAFF_TOTP_SECRET?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  [TEST_CLERK_CLIENT]?: ClerkClientLike;
  ORDERS_ENABLED?: string;
  CUSTOMER_AUTH_ENABLED?: string;
  STAFF_AUTH_ENABLED?: string;
  PAYMENTS_ENABLED?: string;
  PAYSTACK_SECRET_KEY?: string;
  PUBLIC_APP_ORIGIN?: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages?: unknown;
  message?: unknown;
};

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 8_000;
const MAX_BODY_BYTES = 16_384;

const unavailableReply =
  "That information isn't currently available. Please contact Damien's Smoky Kitchen on WhatsApp for assistance.";

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "system" ||
      message.role === "user" ||
      message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_MESSAGE_LENGTH
  );
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function fallbackReply(question: string): string {
  return getChatbotReply(question) || unavailableReply;
}

async function readLimitedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rate = await env.CHAT_RATE_LIMIT.limit({ key: clientKey });
  if (!rate.success) {
    return Response.json({ error: "Too many messages. Please try again shortly." }, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  let body: ChatRequest;
  try {
    const rawBody = await readLimitedBody(request);
    if (rawBody === null) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody) as ChatRequest;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  let messages: ChatMessage[];
  if (Array.isArray(body.messages)) {
    if (
      body.messages.length === 0 ||
      body.messages.length > MAX_MESSAGES ||
      !body.messages.every(isChatMessage)
    ) {
      return Response.json(
        { error: "Messages must have a supported role and non-empty content." },
        { status: 400 },
      );
    }
    messages = body.messages;
  } else if (
    typeof body.message === "string" &&
    body.message.trim() &&
    body.message.length <= MAX_MESSAGE_LENGTH
  ) {
    messages = [{ role: "user", content: body.message.trim() }];
  } else {
    return Response.json(
      { error: "Request body must include a messages array." },
      { status: 400 },
    );
  }

  if (messages.some((message) => message.role === "system")) {
    return Response.json({ error: "System messages are not accepted." }, { status: 400 });
  }

  if (
    messages.reduce((total, message) => total + message.content.length, 0) >
    MAX_TOTAL_LENGTH
  ) {
    return Response.json(
      { error: "The conversation is too long." },
      { status: 400 },
    );
  }

  if (messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "The latest message must be from the user." }, { status: 400 });
  }

  const question = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content.trim();
  if (!question) return textResponse(unavailableReply);

  // Deterministic answers remain the default path and do not consume AI requests.
  const manualReply = getManualReply(question);
  if (manualReply !== null) return textResponse(manualReply);

  const systemMessage: ChatMessage = {
    role: "system",
    content: `You are Damien's Smoky Kitchen assistant. Answer naturally, politely, and briefly. Use ONLY the official restaurant knowledge below. Never invent menu items, prices, delivery fees or times, nutritional or allergy information, halal certification, promotions, policies, orders, or reservations. If the answer is not in the knowledge, say it is not currently available and direct the customer to WhatsApp. Do not claim an order or reservation was completed.\n\nOFFICIAL RESTAURANT KNOWLEDGE:\n${officialMenuContext}`,
  };

  try {
    const aiResponse = await env.AI.run(MODEL, {
      messages: [
        systemMessage,
        ...messages.filter((message) => message.role !== "system"),
      ],
    });
    const reply =
      typeof aiResponse === "object" &&
      aiResponse !== null &&
      "response" in aiResponse
        ? String(aiResponse.response)
        : String(aiResponse);

    return reply.trim()
      ? textResponse(reply.trim())
      : textResponse(fallbackReply(question));
  } catch (error) {
    console.error("Workers AI request failed:", error);
    return textResponse(fallbackReply(question));
  }
}

type OrderLineInput = { name?: unknown; category?: unknown; quantity?: unknown };
type OrderPreviewInput = { name?: unknown; phone?: unknown; address?: unknown; state?: unknown; adultConfirmed?: unknown; items?: unknown };

async function handleOrderPreview(request: Request, env: Env, customer: CustomerProfile): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rate = await env.ORDER_RATE_LIMIT.limit({ key: "preview:" + clientKey });
  if (!rate.success) {
    return Response.json({ error: "Too many order reviews. Please try again shortly." }, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  let body: OrderPreviewInput;
  try {
    const rawBody = await readLimitedBody(request);
    if (rawBody === null) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody) as OrderPreviewInput;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  if (
    typeof body.name !== "string" || body.name.trim().length < 1 || body.name.length > 100 ||
    typeof body.phone !== "string" || !/^[+\d\s()\-]{8,24}$/.test(body.phone) || body.phone.replace(/\D/g, "").length < 8 ||
    typeof body.address !== "string" || body.address.trim().length < 5 || body.address.length > 300 ||
    body.state !== "Lagos" ||
    body.adultConfirmed !== true ||
    !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30
  ) {
    return Response.json({ error: "Confirm you are 18 or older, or that you are a parent/legal guardian placing the order with your own details. Check the name, phone, Lagos address and basket." }, { status: 400 });
  }

  let subtotal = 0;
  for (const candidate of body.items as OrderLineInput[]) {
    if (
      typeof candidate?.name !== "string" ||
      typeof candidate.category !== "string" ||
      !Number.isInteger(candidate.quantity) ||
      Number(candidate.quantity) < 1 ||
      Number(candidate.quantity) > 20
    ) {
      return Response.json({ error: "One or more basket items are invalid." }, { status: 400 });
    }
    const item = [...restaurantKnowledge.menu, ...restaurantKnowledge.drinksMenu, ...restaurantKnowledge.veganMenu].find(
      (entry) => entry.name === candidate.name && entry.category === candidate.category,
    );
    if (!item || item.price === null) {
      return Response.json({ error: "One or more basket items are not available at a listed price." }, { status: 400 });
    }
    subtotal += item.price * Number(candidate.quantity);
  }

  if (subtotal < restaurantKnowledge.minimumDeliveryOrder) {
    return Response.json({
      error: `The minimum delivery order is ₦${restaurantKnowledge.minimumDeliveryOrder.toLocaleString("en-NG")}.`,
      subtotal,
      minimumOrder: restaurantKnowledge.minimumDeliveryOrder,
    }, { status: 422 });
  }

  return Response.json({
    ok: true,
    orderSubmitted: false,
    subtotal,
    deliveryFee: null,
    message: "Basket details are valid. The delivery fee depends on distance and must be confirmed by the restaurant. This review has not submitted an order.",
  }, { headers: { "Cache-Control": "no-store" } });
}


async function handleOrderCreate(request: Request, env: Env, customer: CustomerProfile): Promise<Response> {
  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rate = await env.ORDER_RATE_LIMIT.limit({ key: clientKey });
  if (!rate.success) return Response.json({ error: "Too many order attempts. Please try again shortly." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });

  const preview = await handleOrderPreview(request.clone(), env, customer);
  if (!preview.ok) return preview;

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    return Response.json({ error: "A valid order request key is required. Please retry." }, { status: 400 });
  }

  let body: OrderPreviewInput;
  try { body = JSON.parse(await request.text()) as OrderPreviewInput; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const normalizedRequest = {
    customerId: customer.id,
    address: (body.address as string).trim(),
    state: "Lagos",
    items: (body.items as OrderLineInput[]).map((item) => ({ name: item.name, category: item.category, quantity: item.quantity })),
  };
  const requestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(normalizedRequest))));
  const requestHash = Array.from(requestHashBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const existing = await env.DB.prepare("SELECT id, customer_id, request_hash, subtotal_ngn, status FROM orders WHERE idempotency_key = ?")
    .bind(idempotencyKey).first<{ id: string; customer_id: string | null; request_hash: string | null; subtotal_ngn: number; status: string }>();
  if (existing) {
    if (existing.customer_id !== customer.id || existing.request_hash !== requestHash) {
      return Response.json({ error: "This order request key cannot be reused. Start a new order request." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({
      ok: true, orderSubmitted: true, duplicate: true, orderId: existing.id,
      status: existing.status, subtotal: existing.subtotal_ngn,
      message: "This order request was already received. The restaurant must confirm it.",
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const items = body.items as OrderLineInput[];
  const menu = [...restaurantKnowledge.menu, ...restaurantKnowledge.drinksMenu, ...restaurantKnowledge.veganMenu];
  const lines = items.map((candidate) => {
    const item = menu.find((entry) => entry.name === candidate.name && entry.category === candidate.category);
    if (!item || item.price === null) throw new Error("Validated menu item disappeared.");
    const quantity = Number(candidate.quantity);
    return { name: item.name, category: item.category, quantity, unitPrice: item.price, lineTotal: item.price * quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const orderId = crypto.randomUUID();

  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO orders (id, idempotency_key, customer_id, request_hash, customer_name, customer_phone, delivery_address, delivery_state, subtotal_ngn, status, adult_confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Lagos', ?, 'pending', ?)")
        .bind(orderId, idempotencyKey, customer.id, requestHash, customer.name, customer.phone, (body.address as string).trim(), subtotal, new Date().toISOString()),
      ...lines.map((line) => env.DB.prepare("INSERT INTO order_items (order_id, item_name, category, quantity, unit_price_ngn, line_total_ngn) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(orderId, line.name, line.category, line.quantity, line.unitPrice, line.lineTotal)),
    ]);
  } catch (error) {
    const duplicate = await env.DB.prepare("SELECT id, customer_id, request_hash, subtotal_ngn, status FROM orders WHERE idempotency_key = ?")
      .bind(idempotencyKey).first<{ id: string; customer_id: string | null; request_hash: string | null; subtotal_ngn: number; status: string }>();
    if (duplicate?.customer_id === customer.id && duplicate.request_hash === requestHash) return Response.json({
      ok: true, orderSubmitted: true, duplicate: true, orderId: duplicate.id,
      status: duplicate.status, subtotal: duplicate.subtotal_ngn,
      message: "This order request was already received. The restaurant must confirm it.",
    }, { headers: { "Cache-Control": "no-store" } });
    console.error("Order persistence failed.");
    return Response.json({ error: "We could not safely save this order. Please try again or contact the restaurant." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({
    ok: true, orderSubmitted: true, duplicate: false, orderId, status: "pending", subtotal,
    message: "Your order request has been saved. The restaurant must confirm availability and the delivery fee before the order is accepted.",
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}


type CustomerOrderRow = {
  id: string; status: string; subtotal_ngn: number; delivery_fee_ngn: number | null;
  delivery_fee_confirmed_at: string | null; payment_status: string; payment_reference: string | null;
  customer_accepted_total_ngn: number | null; created_at: string; updated_at: string;
};
type PaystackVerifyResponse = {
  status?: boolean;
  data?: { status?: string; reference?: string; amount?: number; currency?: string;
    metadata?: { order_id?: string; customer_id?: string } | null };
};

function paymentConfigurationAvailable(env: Env): boolean {
  return env.PAYMENTS_ENABLED === "true" && Boolean(env.PAYSTACK_SECRET_KEY?.startsWith("sk_")) && Boolean(env.PUBLIC_APP_ORIGIN);
}
async function readJsonObject(request: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  const raw = await readLimitedBody(request);
  if (raw === null || new TextEncoder().encode(raw).byteLength > maxBytes) return null;
  try { const value: unknown = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
  catch { return null; }
}
export async function paystackSignatureIsValid(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  let mismatch = expected.length ^ signature.length;
  const supplied = signature.toLowerCase();
  for (let i = 0; i < Math.min(expected.length, supplied.length); i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}
async function getCustomerOrder(env: Env, orderId: string, customerId: string): Promise<CustomerOrderRow | null> {
  return env.DB.prepare("SELECT id, status, subtotal_ngn, delivery_fee_ngn, delivery_fee_confirmed_at, payment_status, payment_reference, customer_accepted_total_ngn, created_at, updated_at FROM orders WHERE id = ? AND customer_id = ?")
    .bind(orderId, customerId).first<CustomerOrderRow>();
}
async function handleCustomerOrderRead(env: Env, url: URL, customer: CustomerProfile): Promise<Response> {
  if (url.pathname === "/api/orders/mine") {
    const result = await env.DB.prepare("SELECT id, status, subtotal_ngn, delivery_fee_ngn, payment_status, created_at, updated_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50")
      .bind(customer.id).all<Omit<CustomerOrderRow, "delivery_fee_confirmed_at" | "payment_reference" | "customer_accepted_total_ngn">>();
    return Response.json({ orders: result.results ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const orderId = decodeURIComponent(url.pathname.slice("/api/orders/".length));
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return Response.json({ error: "Invalid order identifier." }, { status: 400 });
  const order = await getCustomerOrder(env, orderId, customer.id);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const lines = await env.DB.prepare("SELECT item_name, category, quantity, unit_price_ngn, line_total_ngn FROM order_items WHERE order_id = ? ORDER BY id")
    .bind(orderId).all<{ item_name: string; category: string; quantity: number; unit_price_ngn: number; line_total_ngn: number }>();
  return Response.json({ order, items: lines.results ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
async function handlePaystackInitialize(request: Request, env: Env, customer: CustomerProfile, orderId: string): Promise<Response> {
  if (!paymentConfigurationAvailable(env)) return Response.json({ error: "Online payments are not enabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const rate = await env.ORDER_RATE_LIMIT.limit({ key: "pay-init:" + customer.id });
  if (!rate.success) return Response.json({ error: "Too many payment attempts. Please wait and try again." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  const body = await readJsonObject(request);
  if (!body || !Number.isSafeInteger(body.acceptedTotalNgn)) return Response.json({ error: "Confirm the exact order total before continuing to payment." }, { status: 400 });
  const order = await env.DB.prepare("SELECT o.id, o.status, o.subtotal_ngn, o.delivery_fee_ngn, o.delivery_fee_confirmed_at, o.payment_status, o.payment_reference, o.payment_authorization_url, c.email FROM orders o JOIN customer_accounts c ON c.id = o.customer_id WHERE o.id = ? AND o.customer_id = ?")
    .bind(orderId, customer.id).first<{ id: string; status: string; subtotal_ngn: number; delivery_fee_ngn: number | null; delivery_fee_confirmed_at: string | null; payment_status: string; payment_reference: string | null; payment_authorization_url: string | null; email: string }>();
  if (!order) return Response.json({ error: "Order not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (order.status !== "accepted" || order.delivery_fee_ngn === null || !order.delivery_fee_confirmed_at) return Response.json({ error: "The restaurant must accept the order and confirm its delivery fee before payment." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  const totalNgn = order.subtotal_ngn + order.delivery_fee_ngn;
  if (body.acceptedTotalNgn !== totalNgn) return Response.json({ error: "The confirmed order total changed. Review and accept the latest total." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  if (order.payment_status === "paid") return Response.json({ error: "This order has already been paid." }, { status: 409 });
  if (order.payment_status === "pending" && order.payment_authorization_url && order.payment_reference) return Response.json({ authorizationUrl: order.payment_authorization_url, reference: order.payment_reference, totalNgn }, { headers: { "Cache-Control": "no-store" } });
  const reference = "dsk_" + crypto.randomUUID().replaceAll("-", "");
  const reserved = await env.DB.prepare("UPDATE orders SET payment_status = 'initializing', payment_reference = ?, payment_authorization_url = NULL, payment_access_code = NULL, customer_accepted_total_ngn = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND customer_id = ? AND status = 'accepted' AND delivery_fee_confirmed_at IS NOT NULL AND payment_status IN ('unpaid', 'failed')")
    .bind(reference, totalNgn, orderId, customer.id).run() as { meta?: { changes?: number } };
  if (reserved.meta?.changes !== 1) return Response.json({ error: "A payment attempt is already in progress. Refresh the order status before retrying." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", headers: { "Authorization": "Bearer " + env.PAYSTACK_SECRET_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: order.email, amount: totalNgn * 100, currency: "NGN", reference,
        callback_url: (env.PUBLIC_APP_ORIGIN as string) + "/checkout?payment=return",
        metadata: { order_id: order.id, customer_id: customer.id } }),
    });
  } catch {
    await env.DB.prepare("UPDATE orders SET payment_status = 'failed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND payment_reference = ? AND payment_status = 'initializing'").bind(orderId, reference).run();
    return Response.json({ error: "The payment provider could not be reached. No payment confirmation was recorded." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  let provider: { status?: boolean; data?: { reference?: string; authorization_url?: string; access_code?: string } };
  try { provider = await providerResponse.json() as typeof provider; } catch { provider = {}; }
  let authorizationUrl: URL | null = null;
  try { authorizationUrl = new URL(provider.data?.authorization_url ?? ""); } catch { /* invalid provider URL */ }
  if (!providerResponse.ok || provider.status !== true || provider.data?.reference !== reference || !provider.data?.access_code ||
      authorizationUrl?.protocol !== "https:" || authorizationUrl.hostname !== "checkout.paystack.com") {
    await env.DB.prepare("UPDATE orders SET payment_status = 'failed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND payment_reference = ? AND payment_status = 'initializing'").bind(orderId, reference).run();
    return Response.json({ error: "The payment provider did not return a valid checkout session." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  await env.DB.prepare("UPDATE orders SET payment_status = 'pending', payment_access_code = ?, payment_authorization_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND payment_reference = ? AND payment_status = 'initializing'")
    .bind(provider.data.access_code, authorizationUrl.toString(), orderId, reference).run();
  return Response.json({ authorizationUrl: authorizationUrl.toString(), reference, totalNgn }, { headers: { "Cache-Control": "no-store" } });
}
async function confirmPaystackPayment(env: Env, reference: string, eventKey: string): Promise<boolean> {
  if (!env.PAYSTACK_SECRET_KEY?.startsWith("sk_")) return false;
  const order = await env.DB.prepare("SELECT id, customer_id, payment_status, customer_accepted_total_ngn FROM orders WHERE payment_reference = ?")
    .bind(reference).first<{ id: string; customer_id: string; payment_status: string; customer_accepted_total_ngn: number | null }>();
  if (!order || !order.customer_id || order.customer_accepted_total_ngn === null) return false;
  if (order.payment_status === "paid") return true;
  let response: Response;
  try { response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), { headers: { "Authorization": "Bearer " + env.PAYSTACK_SECRET_KEY } }); }
  catch { return false; }
  if (!response.ok) return false;
  let result: PaystackVerifyResponse;
  try { result = await response.json() as PaystackVerifyResponse; } catch { return false; }
  const data = result.data;
  if (result.status !== true || data?.status !== "success" || data.reference !== reference ||
      data.amount !== order.customer_accepted_total_ngn * 100 || data.currency !== "NGN" ||
      (data.metadata?.order_id && data.metadata.order_id !== order.id) ||
      (data.metadata?.customer_id && data.metadata.customer_id !== order.customer_id)) return false;
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO payment_events (provider, provider_event_key, order_id, payment_reference, event_type) VALUES ('paystack', ?, ?, ?, 'charge.success')").bind(eventKey, order.id, reference),
    env.DB.prepare("UPDATE orders SET payment_status = 'paid', payment_paid_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND payment_reference = ? AND customer_accepted_total_ngn = ? AND payment_status IN ('pending', 'initializing')")
      .bind(order.id, reference, order.customer_accepted_total_ngn),
  ]);
  const current = await env.DB.prepare("SELECT payment_status FROM orders WHERE id = ? AND payment_reference = ?").bind(order.id, reference).first<{ payment_status: string }>();
  return current?.payment_status === "paid";
}
async function handlePaystackVerify(request: Request, env: Env, customer: CustomerProfile, orderId: string): Promise<Response> {
  if (!paymentConfigurationAvailable(env)) return Response.json({ error: "Online payments are not enabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const body = await readJsonObject(request);
  const reference = typeof body?.reference === "string" ? body.reference : "";
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(reference)) return Response.json({ error: "Invalid payment reference." }, { status: 400 });
  const order = await getCustomerOrder(env, orderId, customer.id);
  if (!order || order.payment_reference !== reference) return Response.json({ error: "Payment reference not found for this order." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!(await confirmPaystackPayment(env, reference, "verify:" + reference))) return Response.json({ error: "Payment has not been verified. Do not retry payment until the status is checked." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ok: true, paymentStatus: "paid" }, { headers: { "Cache-Control": "no-store" } });
}
async function handlePaystackWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret?.startsWith("sk_")) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const rawBody = await readLimitedBody(request);
  if (rawBody === null) return Response.json({ error: "Invalid webhook body." }, { status: 413 });
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!(await paystackSignatureIsValid(rawBody, signature, secret))) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let event: { event?: string; data?: { id?: number; reference?: string } };
  try { event = JSON.parse(rawBody) as typeof event; } catch { return Response.json({ error: "Invalid webhook JSON." }, { status: 400 }); }
  if (event.event !== "charge.success") return Response.json({ received: true });
  const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
  if (!reference) return Response.json({ error: "Missing payment reference." }, { status: 400 });
  const eventKey = "webhook:" + event.event + ":" + String(event.data?.id ?? reference);
  const alreadyProcessed = await env.DB.prepare("SELECT id FROM payment_events WHERE provider_event_key = ?").bind(eventKey).first<{ id: number }>();
  if (alreadyProcessed) return Response.json({ received: true, duplicate: true });
  if (!(await confirmPaystackPayment(env, reference, eventKey))) return Response.json({ error: "Payment verification is pending." }, { status: 503 });
  return Response.json({ received: true });
}


export const TEST_AUTH_BYPASS = Symbol("test-auth-bypass");
function customerAuthAvailable(env: Env): boolean {
  const hasClerkConfig = Boolean(env.CLERK_SECRET_KEY?.startsWith("sk_") && env.CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));
  const hasTestClient = env[TEST_AUTH_BYPASS] === true && Boolean(env[TEST_CLERK_CLIENT]);
  return env.CUSTOMER_AUTH_ENABLED === "true" && (hasClerkConfig || hasTestClient);
}
function onlineOrderingAvailable(env: Env): boolean {
  return env.ORDERS_ENABLED === "true" && customerAuthAvailable(env);
}

const SESSION_COOKIE = "__Host-dsk_session";
const SESSION_TTL_SECONDS = 604800;
const PBKDF2_ITERATIONS = 600000;
function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function unb64url(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function hashToken(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function derivePassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(new ArrayBuffer(salt.byteLength));
  saltBuffer.set(salt);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBuffer, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256));
}
async function makePasswordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return b64url(salt) + "." + b64url(await derivePassword(password, salt));
}
async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const parts = encoded.split(".");
    if (parts.length !== 2) return false;
    const expected = unb64url(parts[1]);
    const actual = await derivePassword(password, unb64url(parts[0]));
    if (expected.length !== actual.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ actual[i];
    return mismatch === 0;
  } catch { return false; }
}
function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim() || null;
  }
  return null;
}
function setSessionCookie(token: string): string {
  return SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + SESSION_TTL_SECONDS;
}
function clearSessionCookie(): string {
  return SESSION_COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
type SessionRow = { role: "customer" | "staff"; user_id: string; expires_at: number };
function authResponse(data: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "Pragma": "no-cache" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(data, { status, headers });
}
async function issueSession(env: Env, role: "customer" | "staff", userId: string): Promise<string> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await hashToken(token);
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(Math.floor(Date.now() / 1000)).run();
  await env.DB.prepare("INSERT INTO auth_sessions (token_hash, role, user_id, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, role, userId, expires).run();
  return token;
}
async function currentSession(request: Request, env: Env): Promise<SessionRow | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token || token.length > 128) return null;
  const session = await env.DB.prepare("SELECT role, user_id, expires_at FROM auth_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await hashToken(token), Math.floor(Date.now() / 1000)).first<SessionRow>();
  if (session?.role === "staff" && (env.STAFF_AUTH_ENABLED !== "true" || !hasValidTotpSecret(env.STAFF_TOTP_SECRET) || session.user_id !== (env.STAFF_EMAIL ?? "").trim().toLowerCase())) return null;
  if (session?.role === "customer") return null; // Legacy password sessions are no longer accepted.
  return session;
}
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value: string): Uint8Array | null {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  if (!normalized || normalized.length > 128 || !/^[A-Z2-7]+$/.test(normalized)) return null;
  let buffer = 0;
  let bits = 0;
  const output: number[] = [];
  for (const character of normalized) {
    buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output);
}

function hasValidTotpSecret(value: string | undefined): boolean {
  const decoded = value ? decodeBase32(value) : null;
  return Boolean(decoded && decoded.length >= 20);
}

async function verifyTotp(secret: string | undefined, code: string): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const secretBytes = secret ? decodeBase32(secret) : null;
  if (!secretBytes || secretBytes.length < 20) return null;
  const secretBuffer = new Uint8Array(new ArrayBuffer(secretBytes.byteLength));
  secretBuffer.set(secretBytes);
  const key = await crypto.subtle.importKey("raw", secretBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const currentStep = BigInt(Math.floor(Date.now() / 30_000));
  for (const drift of [-1n, 0n, 1n]) {
    let counter = currentStep + drift;
    if (counter < 0n) continue;
    const message = new Uint8Array(8);
    for (let index = 7; index >= 0; index--) {
      message[index] = Number(counter & 0xffn);
      counter >>= 8n;
    }
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
    const expected = String(binary % 1_000_000).padStart(6, "0");
    let mismatch = 0;
    for (let index = 0; index < 6; index++) mismatch |= expected.charCodeAt(index) ^ code.charCodeAt(index);
    if (mismatch === 0) return Number(currentStep + drift);
  }
  return null;
}

function validEmail(value: string): boolean { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
type CustomerProfile = { id: string; name: string; email: string; phone: string };
type ClerkIdentity = { client: ClerkClientLike; userId: string; user: ClerkUserRecord; email: string; name: string };

async function getClerkIdentity(request: Request, env: Env, url: URL): Promise<ClerkIdentity | null> {
  const client = env[TEST_CLERK_CLIENT] ?? (createClerkClient({
    secretKey: env.CLERK_SECRET_KEY!,
    publishableKey: env.CLERK_PUBLISHABLE_KEY!,
  }) as unknown as ClerkClientLike);
  const state = await client.authenticateRequest(request, { authorizedParties: [url.origin] });
  if (!state.isAuthenticated) return null;
  const userId = state.toAuth().userId;
  if (!userId) return null;
  const user = await client.users.getUser(userId);
  const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress.trim().toLowerCase();
  if (!validEmail(email)) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || email.split("@")[0];
  return { client, userId, user, email, name: name.slice(0, 100) };
}

async function getCustomerProfileByClerkId(env: Env, clerkUserId: string): Promise<CustomerProfile | null> {
  return env.DB.prepare("SELECT id, name, email, phone FROM customer_accounts WHERE clerk_user_id = ?")
    .bind(clerkUserId).first<CustomerProfile>();
}

async function syncCustomerProfile(
  env: Env,
  identity: ClerkIdentity,
  phone: string,
  adultConfirmed: boolean,
): Promise<{ profile?: CustomerProfile; created?: boolean; error?: string; status?: number }> {
  if (!/^[+\d\s()\-]{8,24}$/.test(phone) || phone.replace(/\D/g, "").length < 8) {
    return { error: "Enter a valid phone number.", status: 400 };
  }

  const linked = await getCustomerProfileByClerkId(env, identity.userId);
  if (linked) {
    await env.DB.prepare("UPDATE customer_accounts SET phone = ? WHERE id = ?").bind(phone.trim(), linked.id).run();
    const updated = await getCustomerProfileByClerkId(env, identity.userId);
    return updated ? { profile: updated, created: false } : { error: "We could not load your customer profile.", status: 503 };
  }

  const existingByEmail = await env.DB.prepare("SELECT id, clerk_user_id FROM customer_accounts WHERE email = ?")
    .bind(identity.email).first<{ id: string; clerk_user_id: string | null }>();
  if (existingByEmail) {
    if (existingByEmail.clerk_user_id && existingByEmail.clerk_user_id !== identity.userId) {
      return { error: "This email is already linked to another customer identity. Contact the restaurant for help.", status: 409 };
    }
    if (!existingByEmail.clerk_user_id) {
      const linkedResult = await env.DB.prepare("UPDATE customer_accounts SET clerk_user_id = ? WHERE id = ? AND clerk_user_id IS NULL")
        .bind(identity.userId, existingByEmail.id).run() as { meta?: { changes?: number } };
      if (linkedResult.meta?.changes !== 1) {
        const retry = await getCustomerProfileByClerkId(env, identity.userId);
        if (!retry) return { error: "This customer account could not be linked safely. Contact the restaurant.", status: 409 };
      }
    }
    await env.DB.prepare("UPDATE customer_accounts SET phone = ? WHERE id = ?").bind(phone.trim(), existingByEmail.id).run();
    const profile = await getCustomerProfileByClerkId(env, identity.userId);
    return profile ? { profile, created: false } : { error: "We could not load your customer profile.", status: 503 };
  }

  if (!adultConfirmed) return { error: "Confirm that you are 18 or older before creating your customer profile.", status: 403 };
  const id = crypto.randomUUID();
  const passwordSentinel = "clerk-only:" + crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO customer_accounts (id, name, email, phone, password_hash, clerk_user_id) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, identity.name, identity.email, phone.trim(), passwordSentinel, identity.userId).run();
  } catch {
    const duplicate = await getCustomerProfileByClerkId(env, identity.userId);
    if (duplicate) return { profile: duplicate, created: false };
    return { error: "We could not create your customer profile. Please retry or contact the restaurant.", status: 409 };
  }
  const profile = await getCustomerProfileByClerkId(env, identity.userId);
  return profile ? { profile, created: true } : { error: "We could not load your new customer profile.", status: 503 };
}

async function handleAuth(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const customerEnabled = customerAuthAvailable(env) && Boolean(env.DB) && Boolean(env.AUTH_RATE_LIMIT) && Boolean(env.AUTH_EMAIL_RATE_LIMIT);
  const staffEnabled = env.STAFF_AUTH_ENABLED === "true" && Boolean(env.STAFF_EMAIL?.trim()) && Boolean(env.STAFF_PASSWORD_HASH) && hasValidTotpSecret(env.STAFF_TOTP_SECRET) && Boolean(env.DB) && Boolean(env.AUTH_RATE_LIMIT) && Boolean(env.AUTH_EMAIL_RATE_LIMIT);

  if (path === "/api/auth/status" && request.method === "GET") return authResponse({ customerEnabled, staffEnabled });

  if (path === "/api/auth/me" && request.method === "GET") {
    const staffSession = await currentSession(request, env);
    if (staffSession?.role === "staff") {
      return authResponse({ authenticated: true, role: "staff", user: { email: staffSession.user_id } });
    }
    if (!customerEnabled) return authResponse({ error: "Customer sign-in is not configured yet." }, 503);
    try {
      const identity = await getClerkIdentity(request, env, url);
      if (!identity) return authResponse({ authenticated: false }, 401);
      const profile = await getCustomerProfileByClerkId(env, identity.userId);
      if (!profile) return authResponse({ authenticated: true, role: "customer", needsProfile: true, user: { name: identity.name, email: identity.email, phone: "" } });
      return authResponse({ authenticated: true, role: "customer", user: profile });
    } catch {
      console.error("Clerk identity lookup failed.");
      return authResponse({ error: "We could not verify your customer session. Please retry." }, 503);
    }
  }

  if (path === "/api/auth/profile" && request.method === "POST") {
    if (request.headers.get("Origin") !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
    if (!customerEnabled) return authResponse({ error: "Customer sign-in is not configured yet." }, 503);
    const limit = await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
    if (!limit.success) return authResponse({ error: "Too many requests. Please wait and try again." }, 429);
    let body: Record<string, unknown>;
    try {
      const raw = await readLimitedBody(request);
      if (raw === null) return authResponse({ error: "Request body is too large." }, 413);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return authResponse({ error: "Invalid request." }, 400);
      body = parsed as Record<string, unknown>;
    } catch {
      return authResponse({ error: "Invalid request." }, 400);
    }
    const phone = typeof body.phone === "string" ? body.phone : "";
    const adultConfirmed = body.adultConfirmed === true;
    try {
      const identity = await getClerkIdentity(request, env, url);
      if (!identity) return authResponse({ error: "A verified Clerk sign-in is required." }, 401);
      const result = await syncCustomerProfile(env, identity, phone, adultConfirmed);
      if (!result.profile) return authResponse({ error: result.error ?? "Profile setup failed." }, result.status ?? 503);
      return authResponse({ ok: true, created: result.created === true, user: result.profile }, result.created ? 201 : 200);
    } catch {
      console.error("Customer profile synchronization failed.");
      return authResponse({ error: "We could not save your customer profile. Please retry." }, 503);
    }
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    if (request.headers.get("Origin") !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
    const token = cookieValue(request, SESSION_COOKIE);
    if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
    return authResponse({ ok: true }, 200, clearSessionCookie());
  }

  if (path === "/api/auth/delete-account" && request.method === "POST") {
    return authResponse({ error: "Account deletion must be completed through the verified Clerk account-management flow. Contact the restaurant for assistance." }, 501);
  }

  if (path === "/api/auth/register" || path === "/api/auth/login") {
    return authResponse({ error: "Customer registration and login are handled by the secure Clerk sign-in pages." }, 410);
  }

  if (path !== "/api/auth/staff/login" || request.method !== "POST") return authResponse({ error: "Not found." }, 404);
  if (!staffEnabled) return authResponse({ error: "Staff sign-in is not enabled yet. Contact the site administrator." }, 503);
  if (request.headers.get("Origin") !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
  const limit = await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
  if (!limit.success) return authResponse({ error: "Too many authentication attempts. Please wait and try again." }, 429);

  let body: Record<string, unknown>;
  try {
    const raw = await readLimitedBody(request);
    if (raw === null) return authResponse({ error: "Request body is too large." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return authResponse({ error: "Invalid request." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return authResponse({ error: "Invalid request." }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!validEmail(email) || password.length < 12 || password.length > 128) return authResponse({ error: "Enter a valid email and a password between 12 and 128 characters." }, 400);
  const emailLimit = await env.AUTH_EMAIL_RATE_LIMIT.limit({ key: await hashToken(email) });
  if (!emailLimit.success) return authResponse({ error: "Too many attempts for this account. Please wait and try again." }, 429);

  const configuredEmail = (env.STAFF_EMAIL ?? "").trim().toLowerCase();
  const configuredHash = env.STAFF_PASSWORD_HASH ?? "";
  const totpCode = typeof body.totpCode === "string" ? body.totpCode : "";
  if (!configuredEmail || !configuredHash || email !== configuredEmail || !(await verifyPassword(password, configuredHash))) {
    return authResponse({ error: "Staff credentials are incorrect or staff login has not been configured." }, 401);
  }
  const acceptedStep = await verifyTotp(env.STAFF_TOTP_SECRET, totpCode);
  if (acceptedStep === null) return authResponse({ error: "Staff credentials are incorrect or staff login has not been configured." }, 401);
  await env.DB.prepare("INSERT OR IGNORE INTO staff_totp_state (user_id, last_accepted_step) VALUES (?, -1)").bind(configuredEmail).run();
  const replayCheck = await env.DB.prepare("UPDATE staff_totp_state SET last_accepted_step = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND last_accepted_step < ?")
    .bind(acceptedStep, configuredEmail, acceptedStep).run() as { meta?: { changes?: number } };
  if (replayCheck.meta?.changes !== 1) return authResponse({ error: "Staff credentials are incorrect or staff login has not been configured." }, 401);
  const token = await issueSession(env, "staff", configuredEmail);
  return authResponse({ ok: true, role: "staff" }, 200, setSessionCookie(token));
}

type StaffOrderRow = { id: string; customer_name: string; customer_phone: string; delivery_address: string; subtotal_ngn: number; delivery_fee_ngn: number | null; status: string; created_at: string; updated_at: string };
async function handleStaffOperations(request: Request, env: Env, url: URL): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session || session.role !== "staff") return authResponse({ error: "Staff authentication required." }, 401);
  if (request.method === "GET" && url.pathname === "/api/staff/orders") {
    const result = await env.DB.prepare("SELECT id, customer_name, customer_phone, delivery_address, subtotal_ngn, delivery_fee_ngn, status, created_at, updated_at FROM orders ORDER BY created_at DESC LIMIT 50").all<StaffOrderRow>();
    const orders = result.results ?? [];
    const ids = orders.map(order => order.id);
    const items: Array<{ order_id: string; item_name: string; quantity: number; line_total_ngn: number }> = [];
    for (const id of ids) {
      const lines = await env.DB.prepare("SELECT order_id, item_name, quantity, line_total_ngn FROM order_items WHERE order_id = ? ORDER BY id").bind(id).all<{ order_id: string; item_name: string; quantity: number; line_total_ngn: number }>();
      items.push(...(lines.results ?? []));
    }
    return authResponse({ orders: orders.map(order => ({ ...order, items: items.filter(item => item.order_id === order.id).map(({ item_name, quantity, line_total_ngn }) => ({ name: item_name, quantity, total: line_total_ngn })) })) });
  }
  if (request.method === "GET" && url.pathname === "/api/staff/logs") {
    const result = await env.DB.prepare("SELECT id, actor, action, target_id, created_at FROM staff_audit_logs ORDER BY id DESC LIMIT 100").all<{ id: number; actor: string; action: string; target_id: string | null; created_at: string }>();
    return authResponse({ logs: result.results ?? [] });
  }
  if (request.method === "PATCH" && /^\/api\/staff\/orders\/[0-9a-f-]{36}\/delivery-fee$/i.test(url.pathname)) {
    if (request.headers.get("Origin") !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
    const id = url.pathname.split("/")[4];
    const body = await readJsonObject(request, 2048);
    const fee = body?.deliveryFeeNgn;
    if (!Number.isSafeInteger(fee) || Number(fee) < 0 || Number(fee) > 500000) return authResponse({ error: "Enter a valid delivery fee in naira." }, 400);
    const update = await env.DB.prepare("UPDATE orders SET delivery_fee_ngn = ?, delivery_fee_confirmed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending' AND payment_status IN ('unpaid', 'failed')")
      .bind(Number(fee), id).run() as { meta?: { changes?: number } };
    if (update.meta?.changes !== 1) return authResponse({ error: "Delivery fee can only be confirmed for an unpaid pending order." }, 409);
    await env.DB.prepare("INSERT INTO staff_audit_logs (actor, action, target_id) VALUES (?, ?, ?)")
      .bind(session.user_id, "order.delivery_fee.confirmed:" + Number(fee), id).run();
    return authResponse({ ok: true, deliveryFeeNgn: Number(fee), deliveryFeeConfirmed: true });
  }
  if (request.method === "PATCH" && url.pathname.startsWith("/api/staff/orders/")) {
    if (request.headers.get("Origin") !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
    const id = decodeURIComponent(url.pathname.slice("/api/staff/orders/".length));
    if (!/^[0-9a-f-]{36}$/i.test(id)) return authResponse({ error: "Invalid order identifier." }, 400);
    let body: Record<string, unknown>;
    try {
      const raw = await readLimitedBody(request);
      if (!raw || raw.length > 2048) return authResponse({ error: "Invalid request." }, 400);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return authResponse({ error: "Invalid request." }, 400);
      body = parsed as Record<string, unknown>;
    } catch { return authResponse({ error: "Invalid request." }, 400); }
    const next = typeof body.status === "string" ? body.status : "";
    const existing = await env.DB.prepare("SELECT status, delivery_fee_confirmed_at FROM orders WHERE id = ?").bind(id).first<{ status: string; delivery_fee_confirmed_at: string | null }>();
    if (!existing) return authResponse({ error: "Order not found." }, 404);
    if (existing.status === next) return authResponse({ ok: true, status: next });
    const transitions: Record<string, string[]> = {
      pending: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["dispatched", "cancelled"],
      dispatched: ["completed", "cancelled"],
      completed: [],
      cancelled: []
    };
    if (next === "accepted" && !existing.delivery_fee_confirmed_at) return authResponse({ error: "Confirm the delivery fee before accepting this order." }, 409);
    if (!Object.prototype.hasOwnProperty.call(transitions, existing.status) || !transitions[existing.status].includes(next)) return authResponse({ error: "This order status transition is not allowed." }, 409);
    await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(next, id),
      env.DB.prepare("INSERT INTO staff_audit_logs (actor, action, target_id) VALUES (?, ?, ?)").bind(session.user_id, "order.status:" + existing.status + "->" + next, id)
    ]);
    return authResponse({ ok: true, status: next });
  }
  return authResponse({ error: "Not found." }, 404);
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const securityHeaders: Record<string, string> = {
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://wired-monitor-3464.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://wired-monitor-3464.clerk.accounts.dev; img-src 'self' data: blob: https://images.unsplash.com https://img.clerk.com https://wired-monitor-3464.clerk.accounts.dev; media-src 'self' https://videos.pexels.com; font-src 'self' data: https://fonts.gstatic.com https://wired-monitor-3464.clerk.accounts.dev; connect-src 'self' https://wired-monitor-3464.clerk.accounts.dev https://api.clerk.com https://clerk-telemetry.com; frame-src https://wired-monitor-3464.clerk.accounts.dev https://challenges.cloudflare.com; worker-src 'self' blob:",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=15552000",
  };
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/auth/")) return withSecurityHeaders(await handleAuth(request, env, url));
    if (url.pathname.startsWith("/api/staff/")) return withSecurityHeaders(await handleStaffOperations(request, env, url));

    if (url.pathname === "/api/payments/paystack/webhook") {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      return withSecurityHeaders(await handlePaystackWebhook(request, env));
    }

    if (url.pathname === "/api/orders/status") {
      if (request.method !== "GET") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      return withSecurityHeaders(Response.json({ enabled: onlineOrderingAvailable(env), paymentsEnabled: paymentConfigurationAvailable(env) }, { headers: { "Cache-Control": "no-store" } }));
    }

    if (url.pathname === "/api/orders/mine" || /^\/api\/orders\/[0-9a-f-]{36}$/i.test(url.pathname)) {
      if (request.method !== "GET") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      if (!customerAuthAvailable(env)) return withSecurityHeaders(Response.json({ error: "Customer sign-in is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      try {
        const identity = await getClerkIdentity(request, env, url);
        if (!identity) return withSecurityHeaders(Response.json({ error: "A verified customer sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } }));
        const customer = await getCustomerProfileByClerkId(env, identity.userId);
        if (!customer) return withSecurityHeaders(Response.json({ error: "Customer profile not found." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
        return withSecurityHeaders(await handleCustomerOrderRead(env, url, customer));
      } catch {
        return withSecurityHeaders(Response.json({ error: "We could not verify your customer session." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      }
    }

    const paymentRoute = url.pathname.match(/^\/api\/orders\/([0-9a-f-]{36})\/payment\/(initialize|verify)$/i);
    if (paymentRoute) {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      if (request.headers.get("Origin") !== url.origin) return withSecurityHeaders(Response.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
      if (!customerAuthAvailable(env)) return withSecurityHeaders(Response.json({ error: "Customer sign-in is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      try {
        const identity = await getClerkIdentity(request, env, url);
        if (!identity) return withSecurityHeaders(Response.json({ error: "A verified customer sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } }));
        const customer = await getCustomerProfileByClerkId(env, identity.userId);
        if (!customer) return withSecurityHeaders(Response.json({ error: "Customer profile not found." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
        const handler = paymentRoute[2] === "initialize" ? handlePaystackInitialize : handlePaystackVerify;
        return withSecurityHeaders(await handler(request, env, customer, paymentRoute[1]));
      } catch {
        return withSecurityHeaders(Response.json({ error: "We could not safely process this payment request." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      }
    }

    if (url.pathname === "/api/orders") {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      const origin = request.headers.get("Origin");
      if (origin !== url.origin) return withSecurityHeaders(Response.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
      if (!onlineOrderingAvailable(env)) return withSecurityHeaders(Response.json({ error: "Online ordering is temporarily unavailable while secure customer-data processing is being completed." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      try {
        const identity = await getClerkIdentity(request, env, url);
        if (!identity) return withSecurityHeaders(Response.json({ error: "A verified customer sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } }));
        const customer = await getCustomerProfileByClerkId(env, identity.userId);
        if (!customer) return withSecurityHeaders(Response.json({ error: "Complete customer profile setup before placing an order." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
        return withSecurityHeaders(await handleOrderCreate(request, env, customer));
      } catch {
        return withSecurityHeaders(Response.json({ error: "We could not verify your customer session." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      }
    }

    if (url.pathname === "/api/orders/preview") {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      if (request.headers.get("Origin") !== url.origin) return withSecurityHeaders(Response.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
      if (!onlineOrderingAvailable(env)) return withSecurityHeaders(Response.json({ error: "Order review is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      try {
        const identity = await getClerkIdentity(request, env, url);
        if (!identity) return withSecurityHeaders(Response.json({ error: "A verified customer sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } }));
        const customer = await getCustomerProfileByClerkId(env, identity.userId);
        if (!customer) return withSecurityHeaders(Response.json({ error: "Complete customer profile setup before reviewing an order." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
        return withSecurityHeaders(await handleOrderPreview(request, env, customer));
      } catch {
        return withSecurityHeaders(Response.json({ error: "We could not verify your customer session." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      }
    }

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return withSecurityHeaders(new Response(null, { status: 204 }));
      if (request.method === "POST") return withSecurityHeaders(await handleChat(request, env));
      return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
