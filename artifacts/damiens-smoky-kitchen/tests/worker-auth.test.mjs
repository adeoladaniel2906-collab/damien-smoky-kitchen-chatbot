import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, pbkdf2Sync } from "node:crypto";
import worker, { TEST_AUTH_BYPASS, TEST_CLERK_CLIENT } from "../src/worker.ts";

const b64url = (value) => Buffer.from(value).toString("base64url");
const STAFF_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let buffer = 0;
  let bits = 0;
  const output = [];
  for (const character of value) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(output);
}

function makeTotpCode(secret, timestamp = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...params) { this.params = params; return this; }
  async first() {
    const p = this.params;
    if (this.sql.includes("SELECT id, name, email, phone FROM customer_accounts WHERE clerk_user_id")) {
      const row = [...this.db.accounts.values()].find(account => account.clerk_user_id === p[0]);
      return row ? { id: row.id, name: row.name, email: row.email, phone: row.phone } : null;
    }
    if (this.sql.includes("SELECT id, clerk_user_id FROM customer_accounts WHERE email")) {
      const row = [...this.db.accounts.values()].find(account => account.email === p[0]);
      return row ? { id: row.id, clerk_user_id: row.clerk_user_id ?? null } : null;
    }
    if (this.sql.includes("SELECT id FROM customer_accounts WHERE email")) {
      const row = [...this.db.accounts.values()].find(account => account.email === p[0]);
      return row ? { id: row.id } : null;
    }
    if (this.sql.includes("SELECT id, password_hash FROM customer_accounts WHERE email")) {
      const row = [...this.db.accounts.values()].find(account => account.email === p[0]);
      return row ? { id: row.id, password_hash: row.password_hash } : null;
    }
    if (this.sql.includes("SELECT password_hash FROM customer_accounts WHERE id")) {
      const row = this.db.accounts.get(p[0]);
      return row ? { password_hash: row.password_hash } : null;
    }
    if (this.sql.includes("SELECT role, user_id, expires_at FROM auth_sessions")) {
      const row = this.db.sessions.get(p[0]);
      return row && row.expires_at > p[1] ? { role: row.role, user_id: row.user_id, expires_at: row.expires_at } : null;
    }
    if (this.sql.includes("SELECT id, name, email, phone FROM customer_accounts")) {
      const row = this.db.accounts.get(p[0]);
      return row ? { id: row.id, name: row.name, email: row.email, phone: row.phone } : null;
    }
    return null;
  }
  async all() { return { results: [] }; }
  async run() {
    const p = this.params;
    if (this.sql.startsWith("INSERT INTO customer_accounts")) {
      const [id, name, email, phone, password_hash, clerk_user_id] = p;
      if ([...this.db.accounts.values()].some(account => account.email === email || (clerk_user_id && account.clerk_user_id === clerk_user_id))) throw new Error("UNIQUE constraint failed");
      this.db.accounts.set(id, { id, name, email, phone, password_hash, clerk_user_id: clerk_user_id ?? null });
    } else if (this.sql.startsWith("UPDATE customer_accounts SET clerk_user_id")) {
      const [clerk_user_id, id] = p;
      const row = this.db.accounts.get(id);
      if (row && !row.clerk_user_id) row.clerk_user_id = clerk_user_id;
      return { success: true, meta: { changes: row && row.clerk_user_id === clerk_user_id ? 1 : 0 } };
    } else if (this.sql.startsWith("UPDATE customer_accounts SET phone")) {
      const [phone, id] = p;
      const row = this.db.accounts.get(id);
      if (row) row.phone = phone;
    } else if (this.sql.startsWith("INSERT INTO auth_sessions")) {
      const [token_hash, role, user_id, expires_at] = p;
      this.db.sessions.set(token_hash, { token_hash, role, user_id, expires_at });
    } else if (this.sql.startsWith("DELETE FROM auth_sessions WHERE expires_at")) {
      for (const [key, value] of this.db.sessions) if (value.expires_at <= p[0]) this.db.sessions.delete(key);
    } else if (this.sql.startsWith("DELETE FROM auth_sessions WHERE token_hash")) {
      this.db.sessions.delete(p[0]);
    } else if (this.sql.startsWith("INSERT OR IGNORE INTO staff_totp_state")) {
      const [userId] = p;
      if (!this.db.totpState.has(userId)) this.db.totpState.set(userId, -1);
    } else if (this.sql.startsWith("UPDATE staff_totp_state SET last_accepted_step")) {
      const [step, userId, minimumStep] = p;
      const current = this.db.totpState.get(userId);
      if (current !== undefined && current < minimumStep) {
        this.db.totpState.set(userId, step);
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 0 } };
    } else if (this.sql.startsWith("DELETE FROM auth_sessions WHERE role")) {
      for (const [key, value] of this.db.sessions) if (value.role === "customer" && value.user_id === p[0]) this.db.sessions.delete(key);
    } else if (this.sql.startsWith("DELETE FROM customer_accounts")) {
      this.db.accounts.delete(p[0]);
    }
    return { success: true };
  }
}

class FakeDatabase {
  accounts = new Map();
  sessions = new Map();
  totpState = new Map();
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

function staffHash(password) {
  const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const hash = pbkdf2Sync(password, salt, 600000, 32, "sha256");
  return b64url(salt) + "." + b64url(hash);
}

function makeEnv(overrides = {}) {
  const clerkUsers = {
    user_clerk_one: {
      id: "user_clerk_one", firstName: "Customer", lastName: "One", primaryEmailAddressId: "email_one",
      emailAddresses: [{ id: "email_one", emailAddress: "one@example.com", verification: { status: "verified" } }],
    },
    user_clerk_two: {
      id: "user_clerk_two", firstName: "Customer", lastName: "Two", primaryEmailAddressId: "email_two",
      emailAddresses: [{ id: "email_two", emailAddress: "two@example.com", verification: { status: "verified" } }],
    },
    user_clerk_unverified: {
      id: "user_clerk_unverified", firstName: "Unverified", lastName: "Customer", primaryEmailAddressId: "email_unverified",
      emailAddresses: [{ id: "email_unverified", emailAddress: "unverified@example.com", verification: { status: "unverified" } }],
    },
  };
  const clerkTestClient = {
    authenticateRequest: async request => {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const userId = token === "clerk-one-token" ? "user_clerk_one" : token === "clerk-two-token" ? "user_clerk_two" : token === "clerk-unverified-token" ? "user_clerk_unverified" : null;
      return { isAuthenticated: Boolean(userId), toAuth: () => ({ userId }) };
    },
    users: { getUser: async userId => clerkUsers[userId] },
  };
  return {
    DB: new FakeDatabase(),
    [TEST_AUTH_BYPASS]: true,
    [TEST_CLERK_CLIENT]: clerkTestClient,
    CLERK_SECRET_KEY: "sk_test_worker-only-placeholder",
    CLERK_PUBLISHABLE_KEY: "pk_test_frontend-placeholder",
    AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
    AUTH_EMAIL_RATE_LIMIT: { limit: async () => ({ success: true }) },
    CHAT_RATE_LIMIT: { limit: async () => ({ success: true }) },
    ORDER_RATE_LIMIT: { limit: async () => ({ success: true }) },
    CUSTOMER_AUTH_ENABLED: "true",
    STAFF_AUTH_ENABLED: "true",
    STAFF_EMAIL: "staff@example.com",
    STAFF_PASSWORD_HASH: staffHash("StaffPassword!2026"),
    STAFF_TOTP_SECRET,
    ORDERS_ENABLED: "false",
    ASSETS: { fetch: async () => new Response("asset") },
    AI: { run: async () => ({ response: "test" }) },
    ...overrides,
  };
}

function request(path, { method = "POST", body, origin = "https://restaurant.example", cookie, authorization } = {}) {
  const headers = new Headers();
  if (origin !== null) headers.set("Origin", origin);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  if (authorization) headers.set("Authorization", authorization);
  return new Request("https://restaurant.example" + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function sessionCookie(response) {
  const raw = response.headers.get("Set-Cookie");
  assert.ok(raw, "session cookie should be set");
  assert.match(raw, /^__Host-dsk_session=/);
  assert.match(raw, /; HttpOnly/);
  assert.match(raw, /; Secure/);
  assert.match(raw, /; SameSite=Lax/);
  return raw.split(";", 1)[0];
}

test("authentication stays disabled unless explicit server-side feature flags are enabled", async () => {
  const env = makeEnv({ CUSTOMER_AUTH_ENABLED: "false", STAFF_AUTH_ENABLED: "false" });
  const status = await worker.fetch(request("/api/auth/status", { method: "GET" }), env);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { customerEnabled: false, staffEnabled: false });
  const registration = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "disabled@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  assert.equal(registration.status, 410);
  const staff = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026" },
  }), env);
  assert.equal(staff.status, 503);
});







test("customer credentials cannot authenticate as staff", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "test@example.com", password: "LongEnoughPassword1!" },
  }), env);
  assert.equal(response.status, 401);
});

test("staff login rejects requests without a valid authenticator code", async () => {
  const env = makeEnv();
  const missing = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026" },
  }), env);
  assert.equal(missing.status, 401);
  const malformed = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026", totpCode: "not-a-code" },
  }), env);
  assert.equal(malformed.status, 401);
  assert.equal(env.DB.sessions.size, 0);
});

test("staff authentication remains disabled when no valid authenticator secret is configured", async () => {
  const env = makeEnv({ STAFF_TOTP_SECRET: undefined });
  const response = await worker.fetch(request("/api/auth/status", { method: "GET" }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { customerEnabled: true, staffEnabled: false });
});

test("staff login accepts a valid TOTP once and rejects replay of the same code", async () => {
  const env = makeEnv();
  const code = makeTotpCode(STAFF_TOTP_SECRET);
  const response = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026", totpCode: code },
  }), env);
  assert.equal(response.status, 200);
  const cookie = sessionCookie(response);
  const me = await worker.fetch(request("/api/auth/me", { method: "GET", cookie }), env);
  assert.equal(me.status, 200);
  const profile = await me.json();
  assert.equal(profile.role, "staff");
  assert.equal(profile.user.email, "staff@example.com");
  const replay = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026", totpCode: code },
  }), env);
  assert.equal(replay.status, 401);
  assert.equal(env.DB.sessions.size, 1);
});





test("staff logout revokes the server-side staff session", async () => {
  const env = makeEnv();
  const login = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026", totpCode: makeTotpCode(STAFF_TOTP_SECRET) },
  }), env);
  assert.equal(login.status, 200);
  const cookie = sessionCookie(login);
  const logout = await worker.fetch(request("/api/auth/logout", { cookie }), env);
  assert.equal(logout.status, 200);
  const me = await worker.fetch(request("/api/auth/me", { method: "GET", cookie }), env);
  assert.equal(me.status, 401);
});

test("legacy password account deletion cannot bypass Clerk account management", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/auth/delete-account", { body: { password: "LongEnoughPassword1!" } }), env);
  assert.equal(response.status, 501);
  assert.equal(env.DB.accounts.size, 0);
});

test("live order collection is disabled by default and does not request customer details", async () => {
  const env = makeEnv();
  const status = await worker.fetch(request("/api/orders/status", { method: "GET" }), env);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { enabled: false });
  const order = await worker.fetch(request("/api/orders", {
    body: { name: "Test User", phone: "08012345678", address: "Ibafo, Lagos", state: "Lagos", adultConfirmed: true, items: [{ name: "Jollof Rice", category: "Rice", quantity: 1 }] },
  }), env);
  assert.equal(order.status, 503);
});

test("order preview rejects an order without adult confirmation", async () => {
  const env = makeEnv({ ORDERS_ENABLED: "true" });
  const response = await worker.fetch(request("/api/orders/preview", {
    body: { name: "Test User", phone: "08012345678", address: "Ibafo, Lagos", state: "Lagos", adultConfirmed: false, items: [{ name: "Jollof Rice", category: "Rice", quantity: 1 }] },
  }), env);
  assert.equal(response.status, 400);
});


test("production customer authentication and online ordering fail closed even when dashboard flags are true", async () => {
  const env = makeEnv({
    CUSTOMER_AUTH_ENABLED: "true",
    ORDERS_ENABLED: "true",
  });
  delete env[TEST_AUTH_BYPASS]; // Simulate Cloudflare: bindings cannot supply symbol-keyed test hooks.
  delete env[TEST_CLERK_CLIENT];
  delete env.CLERK_SECRET_KEY;
  delete env.CLERK_PUBLISHABLE_KEY;
  const status = await worker.fetch(request("/api/auth/status", { method: "GET" }), env);
  assert.deepEqual(await status.json(), { customerEnabled: false, staffEnabled: true });

  const registration = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "production@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  assert.equal(registration.status, 410);
  assert.equal(env.DB.accounts.size, 0);

  const orderStatus = await worker.fetch(request("/api/orders/status", { method: "GET" }), env);
  assert.deepEqual(await orderStatus.json(), { enabled: false });

  const payload = { name: "Test User", phone: "08012345678", address: "Ibafo, Lagos", state: "Lagos", adultConfirmed: true, items: [{ name: "Jollof Rice", category: "Rice", quantity: 1 }] };
  const order = await worker.fetch(request("/api/orders", { body: payload }), env);
  assert.equal(order.status, 503);
  const preview = await worker.fetch(request("/api/orders/preview", { body: payload }), env);
  assert.equal(preview.status, 503);
});




test("Clerk profile sync requires a verified session and keeps customer records isolated", async () => {
  const env = makeEnv();
  const firstSetup = await worker.fetch(request("/api/auth/profile", {
    authorization: "Bearer clerk-one-token",
    body: { phone: "08012345678", adultConfirmed: true },
  }), env);
  assert.equal(firstSetup.status, 201);
  const secondSetup = await worker.fetch(request("/api/auth/profile", {
    authorization: "Bearer clerk-two-token",
    body: { phone: "08087654321", adultConfirmed: true },
  }), env);
  assert.equal(secondSetup.status, 201);

  const firstProfile = await worker.fetch(request("/api/auth/me?userId=attacker-controlled", {
    method: "GET", authorization: "Bearer clerk-one-token",
  }), env);
  assert.equal(firstProfile.status, 200);
  const firstData = await firstProfile.json();
  assert.equal(firstData.user.email, "one@example.com");
  assert.equal(firstData.user.name, "Customer One");
  assert.notEqual(firstData.user.email, "two@example.com");

  const secondProfile = await worker.fetch(request("/api/auth/me", {
    method: "GET", authorization: "Bearer clerk-two-token",
  }), env);
  assert.equal(secondProfile.status, 200);
  assert.equal((await secondProfile.json()).user.email, "two@example.com");
});

test("Clerk profile creation rejects unverified email addresses and missing age confirmation", async () => {
  const env = makeEnv();
  const unverified = await worker.fetch(request("/api/auth/profile", {
    authorization: "Bearer clerk-unverified-token",
    body: { phone: "08012345678", adultConfirmed: true },
  }), env);
  assert.equal(unverified.status, 401);
  const missingConfirmation = await worker.fetch(request("/api/auth/profile", {
    authorization: "Bearer clerk-one-token",
    body: { phone: "08012345678", adultConfirmed: false },
  }), env);
  assert.equal(missingConfirmation.status, 403);
  assert.equal(env.DB.accounts.size, 0);
});

test("Clerk profile synchronization rejects cross-origin requests", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/auth/profile", {
    authorization: "Bearer clerk-one-token",
    body: { phone: "08012345678", adultConfirmed: true },
    origin: "https://attacker.example",
  }), env);
  assert.equal(response.status, 403);
  assert.equal(env.DB.accounts.size, 0);
});




test("Clerk customer tokens and unauthenticated requests cannot read staff orders or audit logs", async () => {
  const env = makeEnv();
  for (const authorization of [undefined, "Bearer clerk-one-token"]) {
    const orders = await worker.fetch(request("/api/staff/orders", { method: "GET", authorization }), env);
    const logs = await worker.fetch(request("/api/staff/logs", { method: "GET", authorization }), env);
    assert.equal(orders.status, 401);
    assert.equal(logs.status, 401);
  }
});

test("valid staff password and TOTP session can read staff operations endpoints", async () => {
  const env = makeEnv();
  const login = await worker.fetch(request("/api/auth/staff/login", {
    body: {
      email: "staff@example.com",
      password: "StaffPassword!2026",
      totpCode: makeTotpCode(STAFF_TOTP_SECRET),
    },
  }), env);
  assert.equal(login.status, 200);
  const staffCookie = sessionCookie(login);

  const identity = await worker.fetch(request("/api/auth/me", { method: "GET", cookie: staffCookie }), env);
  assert.equal(identity.status, 200);
  assert.deepEqual(await identity.json(), {
    authenticated: true,
    role: "staff",
    user: { email: "staff@example.com" },
  });

  const orders = await worker.fetch(request("/api/staff/orders", { method: "GET", cookie: staffCookie }), env);
  const logs = await worker.fetch(request("/api/staff/logs", { method: "GET", cookie: staffCookie }), env);
  assert.equal(orders.status, 200);
  assert.equal(logs.status, 200);
  assert.equal(orders.headers.get("Cache-Control"), "no-store");
  assert.equal(logs.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await orders.json(), { orders: [] });
  assert.deepEqual(await logs.json(), { logs: [] });
});


test("order create and preview reject cross-origin and missing-Origin requests", async () => {
  const env = makeEnv({ CUSTOMER_AUTH_ENABLED: "true", ORDERS_ENABLED: "true" });
  const payload = { name: "Test User", phone: "08012345678", address: "Ibafo, Lagos", state: "Lagos", adultConfirmed: true, items: [{ name: "Jollof Rice", category: "Rice", quantity: 1 }] };

  for (const origin of ["https://attacker.example", null]) {
    const order = await worker.fetch(request("/api/orders", { body: payload, origin }), env);
    const preview = await worker.fetch(request("/api/orders/preview", { body: payload, origin }), env);
    assert.equal(order.status, 403);
    assert.equal(preview.status, 403);
  }
});
