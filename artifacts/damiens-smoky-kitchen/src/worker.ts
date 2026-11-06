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

type LiveMenuItem = Awaited<ReturnType<typeof readMenu>>[number];

function normalizeMenuText(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isMenuQuestion(question: string): boolean {
  return /\b(menu|dish|dishes|food|meal|eat|price|cost|naira|available|availability|sell|stock|vegan|vegetarian|rice|soup|swallow|chicken|beef|fish|protein|drink|beverage|zobo|kunu|chapman|jollof|egusi|amala|fufu|eba|plantain|moi moi)\\b/i.test(question);
}

function buildLiveMenuContext(items: LiveMenuItem[]): string {
  if (items.length === 0) return "The live database currently contains no menu entries.";
  const available = items.filter(item => item.isAvailable);
  const unavailable = items.filter(item => !item.isAvailable);
  const describe = (item: LiveMenuItem) => `- ${item.name} | category: ${item.category} | price: ${item.price === null ? "not specified" : "₦" + item.price.toLocaleString("en-NG")} | dietary: ${item.isVegan ? "vegan" : "not marked vegan"}`;
  return [
    "AVAILABLE ITEMS (these are the only items that may be recommended):",
    ...(available.length ? available.map(describe) : ["- No items are currently marked available."]),
    "UNAVAILABLE ITEMS (do not recommend these as orderable):",
    ...(unavailable.length ? unavailable.map(describe) : ["- None currently marked unavailable."]),
    "All prices are in Nigerian Naira. Availability is taken from the current D1 menu_items table."
  ].join("\n");
}

function getLiveMenuFastReply(question: string, items: LiveMenuItem[]): string | null {
  const normalized = normalizeMenuText(question);
  const matches = items.filter(item => [item.name, ...item.aliases].some(value => {
    const variant = normalizeMenuText(value);
    return variant.length > 1 && normalized.includes(variant);
  }));
  if (matches.length === 0) return null;
  const asksPrice = /\b(price|how much|cost|naira)\\b/i.test(question) || question.includes("₦");
  const asksAvailability = /\b(available|availability|have|sell|stock|do you|is there|can i get)\\b/i.test(question);
  if (!asksPrice && !asksAvailability) return null;
  const unique = Array.from(new Map(matches.map(item => [item.id, item])).values());
  if (asksAvailability) {
    const available = unique.filter(item => item.isAvailable);
    const unavailable = unique.filter(item => !item.isAvailable);
    return [
      ...available.map(item => `${item.name}${item.price === null ? "" : " (₦" + item.price.toLocaleString("en-NG") + ")"} is available.`),
      ...unavailable.map(item => `${item.name} is currently unavailable.`)
    ].join("\n");
  }
  return unique.map(item => `${item.name}: ${item.price === null ? "price not currently listed" : "₦" + item.price.toLocaleString("en-NG")}${item.isAvailable ? "" : " (currently unavailable)"}`).join("\n");
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

  // Menu questions read the current D1 catalogue. Never answer from bundled menu prices.
  const menuRelated = isMenuQuestion(question);
  let liveMenuRows: Awaited<ReturnType<typeof readMenu>> = [];
  let liveMenuContext = "";
  if (menuRelated) {
    try {
      liveMenuRows = await readMenu(env, true);
      liveMenuContext = buildLiveMenuContext(liveMenuRows);
      const exactReply = getLiveMenuFastReply(question, liveMenuRows);
      if (exactReply) return textResponse(exactReply);
    } catch (error) {
      console.error("Live menu lookup failed:", error);
      return textResponse("I'm unable to verify the live menu right now. Please try again shortly or contact the restaurant on WhatsApp.", 503);
    }
  }

  // Non-menu facts keep their deterministic fast path. Menu facts must use live D1 data.
  const manualReply = menuRelated ? null : getManualReply(question);
  if (manualReply !== null) return textResponse(manualReply);

  const restaurantInfo = officialMenuContext.split("\nCOMPLETE MENU")[0];
  const systemMessage: ChatMessage = {
    role: "system",
    content: `You are Damien's Smoky Kitchen assistant. Answer naturally, politely, and briefly. Use the restaurant information and LIVE DATABASE MENU below. For every menu item, price, vegan label, and availability question, trust the LIVE DATABASE MENU only. Never use an old menu price or invent an item, ingredient, allergy detail, delivery fee or time, halal certification, promotion, policy, order or reservation. Items marked unavailable must never be recommended as orderable. If the database does not contain an item, say it is not listed. If the live menu is unavailable, do not guess. Do not claim an order or reservation was completed.\n\nRESTAURANT INFORMATION:\n${restaurantInfo}\n\nLIVE DATABASE MENU:\n${liveMenuContext || "This question does not require menu data."}`,
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
      : textResponse(menuRelated ? "I couldn't prepare an answer from the current menu. Please try again." : fallbackReply(question));
  } catch (error) {
    console.error("Workers AI request failed:", error);
    return textResponse(menuRelated ? "The live menu assistant is temporarily unavailable. Please try again shortly." : fallbackReply(question));
  }
}

type OrderLineInput = { name?: unknown; category?: unknown; quantity?: unknown };
type OrderPreviewInput = { name?: unknown; phone?: unknown; address?: unknown; state?: unknown; adultConfirmed?: unknown; items?: unknown };

async function handleOrderPreview(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rate = await env.CHAT_RATE_LIMIT.limit({ key: clientKey });
  if (!rate.success) {
    return Response.json({ error: "Too many requests. Please try again shortly." }, {
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


async function handleOrderCreate(request: Request, env: Env): Promise<Response> {
  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rate = await env.ORDER_RATE_LIMIT.limit({ key: clientKey });
  if (!rate.success) return Response.json({ error: "Too many order attempts. Please try again shortly." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });

  const preview = await handleOrderPreview(request.clone(), env);
  if (!preview.ok) return preview;

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
    return Response.json({ error: "A valid order request key is required. Please retry." }, { status: 400 });
  }

  let body: OrderPreviewInput;
  try { body = JSON.parse(await request.text()) as OrderPreviewInput; }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const existing = await env.DB.prepare("SELECT id, subtotal_ngn, status FROM orders WHERE idempotency_key = ?")
    .bind(idempotencyKey).first<{ id: string; subtotal_ngn: number; status: string }>();
  if (existing) return Response.json({
    ok: true, orderSubmitted: true, duplicate: true, orderId: existing.id,
    status: existing.status, subtotal: existing.subtotal_ngn,
    message: "This order request was already received. The restaurant must confirm it.",
  }, { headers: { "Cache-Control": "no-store" } });

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
      env.DB.prepare("INSERT INTO orders (id, idempotency_key, customer_name, customer_phone, delivery_address, delivery_state, subtotal_ngn, status, adult_confirmed_at) VALUES (?, ?, ?, ?, ?, 'Lagos', ?, 'pending', ?)")
        .bind(orderId, idempotencyKey, (body.name as string).trim(), (body.phone as string).trim(), (body.address as string).trim(), subtotal, new Date().toISOString()),
      ...lines.map((line) => env.DB.prepare("INSERT INTO order_items (order_id, item_name, category, quantity, unit_price_ngn, line_total_ngn) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(orderId, line.name, line.category, line.quantity, line.unitPrice, line.lineTotal)),
    ]);
  } catch (error) {
    const duplicate = await env.DB.prepare("SELECT id, subtotal_ngn, status FROM orders WHERE idempotency_key = ?")
      .bind(idempotencyKey).first<{ id: string; subtotal_ngn: number; status: string }>();
    if (duplicate) return Response.json({
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

type MenuDbRow = { id:string; name:string; category:string; price_ngn:number|null; aliases_json:string; is_vegan:number; is_available:number; sort_order:number; updated_at:string };
function serializeMenuRow(row: MenuDbRow) {
  let aliases: string[] = [];
  try { const parsed: unknown = JSON.parse(row.aliases_json); if (Array.isArray(parsed)) aliases = parsed.filter((value): value is string => typeof value === "string"); } catch { aliases = []; }
  return { id:row.id, name:row.name, category:row.category, displayCategory:row.category.startsWith("Vegan ") ? row.category.slice(6) : row.category, price:row.price_ngn, aliases, dietaryLabel:row.is_vegan ? "Vegan" : undefined, isVegan:Boolean(row.is_vegan), isAvailable:Boolean(row.is_available), sortOrder:row.sort_order, updatedAt:row.updated_at };
}
async function readMenu(env: Env, includeUnavailable = false) {
  const query = includeUnavailable
    ? "SELECT id,name,category,price_ngn,aliases_json,is_vegan,is_available,sort_order,updated_at FROM menu_items ORDER BY sort_order,name"
    : "SELECT id,name,category,price_ngn,aliases_json,is_vegan,is_available,sort_order,updated_at FROM menu_items WHERE is_available = 1 ORDER BY sort_order,name";
  const result = await env.DB.prepare(query).all<MenuDbRow>();
  return (result.results ?? []).map(serializeMenuRow);
}
async function handleStaffMenu(request: Request, env: Env, url: URL, actor: string): Promise<Response> {
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) return authResponse({ error:"Request origin is not allowed." },403);
  if (request.method === "GET" && url.pathname === "/api/staff/menu") {
    return authResponse({ items:await readMenu(env,true) });
  }
  if (request.method !== "POST" && request.method !== "PATCH") return authResponse({ error:"Method not allowed." },405);
  let body: Record<string, unknown>;
  try {
    const raw=await readLimitedBody(request);
    if (!raw || raw.length>4096) return authResponse({ error:"Invalid request." },400);
    const parsed: unknown=JSON.parse(raw);
    if (!parsed || typeof parsed!=="object" || Array.isArray(parsed)) return authResponse({ error:"Invalid request." },400);
    body=parsed as Record<string,unknown>;
  } catch { return authResponse({ error:"Invalid request." },400); }
  const name=typeof body.name==="string"?body.name.trim():"";
  const category=typeof body.category==="string"?body.category.trim():"";
  const price=body.price;
  const aliases=Array.isArray(body.aliases)?body.aliases.filter((value):value is string=>typeof value==="string").map(value=>value.trim()).filter(Boolean).slice(0,20):[];
  const vegan=body.isVegan===true;
  const available=body.isAvailable!==false;
  if (request.method==="POST") {
    if (!name || name.length>100 || !category || category.length>60 || !(price===null || (typeof price==="number" && Number.isInteger(price) && price>=0 && price<=10000000))) return authResponse({error:"Enter a valid item name, category and price."},400);
    const id=crypto.randomUUID();
    const max=await env.DB.prepare("SELECT COALESCE(MAX(sort_order),0) AS max_order FROM menu_items").first<{max_order:number}>();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO menu_items (id,name,category,price_ngn,aliases_json,is_vegan,is_available,sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(id,name,category,price,JSON.stringify(aliases),vegan?1:0,available?1:0,(max?.max_order??0)+1),
      env.DB.prepare("INSERT INTO staff_audit_logs (actor,action,target_id) VALUES (?,?,?)").bind(actor,"menu.item_created:"+name,id)
    ]);
    const created=await env.DB.prepare("SELECT id,name,category,price_ngn,aliases_json,is_vegan,is_available,sort_order,updated_at FROM menu_items WHERE id=?").bind(id).first<MenuDbRow>();
    return authResponse({item:created?serializeMenuRow(created):null},201);
  }
  const id=decodeURIComponent(url.pathname.slice("/api/staff/menu/".length));
  if (!id || id.length>180) return authResponse({error:"Invalid menu item identifier."},400);
  const existing=await env.DB.prepare("SELECT id,name,category,price_ngn,aliases_json,is_vegan,is_available,sort_order,updated_at FROM menu_items WHERE id=?").bind(id).first<MenuDbRow>();
  if (!existing) return authResponse({error:"Menu item not found."},404);
  const nextName=body.name===undefined?existing.name:name;
  const nextCategory=body.category===undefined?existing.category:category;
  const nextPrice=body.price===undefined?existing.price_ngn:price;
  const nextAliases=body.aliases===undefined?JSON.parse(existing.aliases_json):aliases;
  const nextVegan=body.isVegan===undefined?Boolean(existing.is_vegan):vegan;
  const nextAvailable=body.isAvailable===undefined?Boolean(existing.is_available):available;
  if (!nextName || nextName.length>100 || !nextCategory || nextCategory.length>60 || !(nextPrice===null || (typeof nextPrice==="number" && Number.isInteger(nextPrice) && nextPrice>=0 && nextPrice<=10000000)) || !Array.isArray(nextAliases)) return authResponse({error:"Menu item details are invalid."},400);
  await env.DB.batch([
    env.DB.prepare("UPDATE menu_items SET name=?,category=?,price_ngn=?,aliases_json=?,is_vegan=?,is_available=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(nextName,nextCategory,nextPrice,JSON.stringify(nextAliases),nextVegan?1:0,nextAvailable?1:0,id),
    env.DB.prepare("INSERT INTO staff_audit_logs (actor,action,target_id) VALUES (?,?,?)").bind(actor,"menu.item_updated:"+nextName,id)
  ]);
  const updated=await env.DB.prepare("SELECT id,name,category,price_ngn,aliases_json,is_vegan,is_available,sort_order,updated_at FROM menu_items WHERE id=?").bind(id).first<MenuDbRow>();
  return authResponse({item:updated?serializeMenuRow(updated):null},200);
}

type StaffOrderRow = { id: string; customer_name: string; customer_phone: string; delivery_address: string; subtotal_ngn: number; delivery_fee_ngn: number | null; status: string; created_at: string; updated_at: string };
async function handleStaffOperations(request: Request, env: Env, url: URL): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session || session.role !== "staff") return authResponse({ error: "Staff authentication required." }, 401);
  if (url.pathname === "/api/staff/menu" || url.pathname.startsWith("/api/staff/menu/")) return handleStaffMenu(request,env,url,session.user_id);
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
    const existing = await env.DB.prepare("SELECT status FROM orders WHERE id = ?").bind(id).first<{ status: string }>();
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
    if (url.pathname === "/api/menu") {
      if (request.method !== "GET") return withSecurityHeaders(Response.json({error:"Method not allowed."},{status:405}));
      const items=await readMenu(env,false);
      return withSecurityHeaders(Response.json({items},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}}));
    }
    if (url.pathname.startsWith("/api/staff/")) return withSecurityHeaders(await handleStaffOperations(request, env, url));

    if (url.pathname === "/api/orders/status") {
      if (request.method !== "GET") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      return withSecurityHeaders(Response.json({ enabled: onlineOrderingAvailable(env) }, { headers: { "Cache-Control": "no-store" } }));
    }

    if (url.pathname === "/api/orders") {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      const origin = request.headers.get("Origin");
      if (origin !== url.origin) return withSecurityHeaders(Response.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
      if (!onlineOrderingAvailable(env)) return withSecurityHeaders(Response.json({ error: "Online ordering is temporarily unavailable while secure customer-data processing is being completed." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      return withSecurityHeaders(await handleOrderCreate(request, env));
    }

    if (url.pathname === "/api/orders/preview") {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      if (request.headers.get("Origin") !== url.origin) return withSecurityHeaders(Response.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } }));
      if (!onlineOrderingAvailable(env)) return withSecurityHeaders(Response.json({ error: "Order review is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }));
      return withSecurityHeaders(await handleOrderPreview(request, env));
    }

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return withSecurityHeaders(new Response(null, { status: 204 }));
      if (request.method === "POST") return withSecurityHeaders(await handleChat(request, env));
      return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
