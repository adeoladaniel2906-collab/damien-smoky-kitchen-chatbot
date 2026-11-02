import { officialMenuContext, restaurantKnowledge } from "./chatbot/knowledge.ts";
import { getChatbotReply, getManualReply } from "./chatbot/reply.ts";

type WorkerMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface Env {
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
    console.error("Order persistence failed:", error);
    return Response.json({ error: "We could not safely save this order. Please try again or contact the restaurant." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({
    ok: true, orderSubmitted: true, duplicate: false, orderId, status: "pending", subtotal,
    message: "Your order request has been saved. The restaurant must confirm availability and the delivery fee before the order is accepted.",
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
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
  if (session?.role === "customer" && env.CUSTOMER_AUTH_ENABLED !== "true") return null;
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
  const secretBuffer = new Uint8Array(new ArrayBuffer(secretBytes.byteLength));\n  secretBuffer.set(secretBytes);\n  const key = await crypto.subtle.importKey("raw", secretBuffer, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
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
async function handleAuth(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const customerAuthEnabled = env.CUSTOMER_AUTH_ENABLED === "true" && Boolean(env.DB) && Boolean(env.AUTH_RATE_LIMIT) && Boolean(env.AUTH_EMAIL_RATE_LIMIT);
  const staffAuthEnabled = env.STAFF_AUTH_ENABLED === "true" && Boolean(env.STAFF_EMAIL?.trim()) && Boolean(env.STAFF_PASSWORD_HASH) && hasValidTotpSecret(env.STAFF_TOTP_SECRET) && Boolean(env.DB) && Boolean(env.AUTH_RATE_LIMIT) && Boolean(env.AUTH_EMAIL_RATE_LIMIT);
  if (path === "/api/auth/status" && request.method === "GET") return authResponse({ customerEnabled: customerAuthEnabled, staffEnabled: staffAuthEnabled });
  if ((path === "/api/auth/register" || path === "/api/auth/login") && !customerAuthEnabled) return authResponse({ error: "Customer accounts are temporarily unavailable while secure sign-in is being configured. You can still place a guest order." }, 503);
  if (path === "/api/auth/staff/login" && !staffAuthEnabled) return authResponse({ error: "Staff sign-in is not enabled yet. Contact the site administrator." }, 503);
  if (path === "/api/auth/me" && request.method === "GET") {
    const session = await currentSession(request, env);
    if (!session) return authResponse({ authenticated: false }, 401);
    if (session.role === "staff") return authResponse({ authenticated: true, role: "staff", user: { email: session.user_id } });
    const customer = await env.DB.prepare("SELECT id, name, email, phone FROM customer_accounts WHERE id = ?")
      .bind(session.user_id).first<{ id: string; name: string; email: string; phone: string }>();
    return customer ? authResponse({ authenticated: true, role: "customer", user: customer }) : authResponse({ authenticated: false }, 401, clearSessionCookie());
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
    const token = cookieValue(request, SESSION_COOKIE);
    if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
    return authResponse({ ok: true }, 200, clearSessionCookie());
  }
  if (path === "/api/auth/delete-account" && request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
    const limit = await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
    if (!limit.success) return authResponse({ error: "Too many requests. Please wait and try again." }, 429);
    const session = await currentSession(request, env);
    if (!session || session.role !== "customer") return authResponse({ error: "Customer sign-in is required." }, 401);
    let body: Record<string, unknown>;
    try {
      const raw = await readLimitedBody(request);
      if (raw === null) return authResponse({ error: "Request body is too large." }, 413);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return authResponse({ error: "Invalid request." }, 400);
      body = parsed as Record<string, unknown>;
    } catch { return authResponse({ error: "Invalid request." }, 400); }
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 12 || password.length > 128) return authResponse({ error: "Enter your current password to confirm account deletion." }, 400);
    const customer = await env.DB.prepare("SELECT password_hash FROM customer_accounts WHERE id = ?")
      .bind(session.user_id).first<{ password_hash: string }>();
    if (!customer || !(await verifyPassword(password, customer.password_hash))) return authResponse({ error: "The password is incorrect." }, 401);
    try {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM auth_sessions WHERE role = 'customer' AND user_id = ?").bind(session.user_id),
        env.DB.prepare("DELETE FROM customer_accounts WHERE id = ?").bind(session.user_id),
      ]);
    } catch (error) {
      console.error("Customer account deletion failed:", error);
      return authResponse({ error: "We could not delete the account. Please contact the restaurant." }, 503);
    }
    return authResponse({ ok: true }, 200, clearSessionCookie());
  }
  if (request.method !== "POST" || !["/api/auth/register", "/api/auth/login", "/api/auth/staff/login"].includes(path)) return authResponse({ error: "Not found." }, 404);
  const origin = request.headers.get("Origin");
  if (origin !== url.origin) return authResponse({ error: "Request origin is not allowed." }, 403);
  const limit = await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
  if (!limit.success) return authResponse({ error: "Too many authentication attempts. Please wait and try again." }, 429);
  let body: Record<string, unknown>;
  try {
    const raw = await readLimitedBody(request);
    if (raw === null) return authResponse({ error: "Request body is too large." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return authResponse({ error: "Invalid request." }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return authResponse({ error: "Invalid request." }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!validEmail(email) || password.length < 12 || password.length > 128) return authResponse({ error: "Enter a valid email and a password between 12 and 128 characters." }, 400);
  const emailLimit = await env.AUTH_EMAIL_RATE_LIMIT.limit({ key: await hashToken(email) });
  if (!emailLimit.success) return authResponse({ error: "Too many attempts for this account. Please wait and try again." }, 429);
  if (path === "/api/auth/register") {
    if (body.adultConfirmed !== true) return authResponse({ error: "You must confirm you are 18 or older to create an account." }, 403);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!name || name.length > 100 || !/^[+\d\s()\-]{8,24}$/.test(phone) || phone.replace(/\D/g, "").length < 8) return authResponse({ error: "Enter your name and a valid phone number." }, 400);
    const existing = await env.DB.prepare("SELECT id FROM customer_accounts WHERE email = ?").bind(email).first<{ id: string }>();
    if (existing) return authResponse({ error: "An account with this email already exists. Please log in." }, 409);
    const id = crypto.randomUUID();
    const passwordHash = await makePasswordHash(password);
    try {
      await env.DB.prepare("INSERT INTO customer_accounts (id, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)")
        .bind(id, name, email, phone, passwordHash).run();
    } catch (error) {
      const duplicate = await env.DB.prepare("SELECT id FROM customer_accounts WHERE email = ?").bind(email).first<{ id: string }>();
      if (duplicate) return authResponse({ error: "An account with this email already exists. Please log in." }, 409);
      console.error("Customer registration failed:", error);
      return authResponse({ error: "We could not create your account. Please try again." }, 503);
    }
    const token = await issueSession(env, "customer", id);
    return authResponse({ ok: true, role: "customer" }, 201, setSessionCookie(token));
  }
  if (path === "/api/auth/staff/login") {
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
  const customer = await env.DB.prepare("SELECT id, password_hash FROM customer_accounts WHERE email = ?")
    .bind(email).first<{ id: string; password_hash: string }>();
  if (!customer || !(await verifyPassword(password, customer.password_hash))) return authResponse({ error: "The email or password is incorrect." }, 401);
  const token = await issueSession(env, "customer", customer.id);
  return authResponse({ ok: true, role: "customer" }, 200, setSessionCookie(token));
}
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const securityHeaders: Record<string, string> = {
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://images.unsplash.com; media-src 'self' https://videos.pexels.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'",
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

    if (url.pathname === "/api/orders") {
      if (request.method !== "POST") return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) return withSecurityHeaders(Response.json({ error: "Cross-origin order requests are not allowed." }, { status: 403 }));
      return withSecurityHeaders(await handleOrderCreate(request, env));
    }

    if (url.pathname === "/api/orders/preview") {
      if (request.method === "POST") return withSecurityHeaders(await handleOrderPreview(request, env));
      return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
    }

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return withSecurityHeaders(new Response(null, { status: 204 }));
      if (request.method === "POST") return withSecurityHeaders(await handleChat(request, env));
      return withSecurityHeaders(Response.json({ error: "Method not allowed." }, { status: 405 }));
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
