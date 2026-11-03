import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, pbkdf2Sync } from "node:crypto";
import worker, { TEST_AUTH_BYPASS } from "../src/worker.ts";

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
  async run() {
    const p = this.params;
    if (this.sql.startsWith("INSERT INTO customer_accounts")) {
      const [id, name, email, phone, password_hash] = p;
      if ([...this.db.accounts.values()].some(account => account.email === email)) throw new Error("UNIQUE constraint failed");
      this.db.accounts.set(id, { id, name, email, phone, password_hash });
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
  return {
    DB: new FakeDatabase(),
    [TEST_AUTH_BYPASS]: true,
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

function request(path, { method = "POST", body, origin = "https://restaurant.example", cookie } = {}) {
  const headers = new Headers({ Origin: origin });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
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
  assert.equal(registration.status, 503);
  const staff = await worker.fetch(request("/api/auth/staff/login", {
    body: { email: "staff@example.com", password: "StaffPassword!2026" },
  }), env);
  assert.equal(staff.status, 503);
});

test("registration rejects cross-origin requests", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "test@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
    origin: "https://attacker.example",
  }), env);
  assert.equal(response.status, 403);
  assert.equal(env.DB.accounts.size, 0);
});

test("registration requires adult confirmation", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "test@example.com", phone: "08012345678", password: "LongEnoughPassword1!" },
  }), env);
  assert.equal(response.status, 403);
  assert.equal(env.DB.accounts.size, 0);
});

test("registration stores a password hash and issues a secure session", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "test@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  assert.equal(response.status, 201);
  assert.equal(env.DB.accounts.size, 1);
  const account = [...env.DB.accounts.values()][0];
  assert.notEqual(account.password_hash, "LongEnoughPassword1!");
  assert.match(account.password_hash, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const cookie = sessionCookie(response);
  const me = await worker.fetch(request("/api/auth/me", { method: "GET", cookie }), env);
  assert.equal(me.status, 200);
  const profile = await me.json();
  assert.equal(profile.role, "customer");
  assert.equal(profile.user.email, "test@example.com");
  assert.equal("password_hash" in profile.user, false);
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

test("logout revokes the server-side session", async () => {
  const env = makeEnv();
  const register = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "logout@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  const cookie = sessionCookie(register);
  const logout = await worker.fetch(request("/api/auth/logout", { cookie }), env);
  assert.equal(logout.status, 200);
  const me = await worker.fetch(request("/api/auth/me", { method: "GET", cookie }), env);
  assert.equal(me.status, 401);
});

test("account deletion requires the current password and revokes sessions", async () => {
  const env = makeEnv();
  const register = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "delete@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  const cookie = sessionCookie(register);
  const denied = await worker.fetch(request("/api/auth/delete-account", { cookie, body: { password: "WrongPassword123!" } }), env);
  assert.equal(denied.status, 401);
  assert.equal(env.DB.accounts.size, 1);
  const deleted = await worker.fetch(request("/api/auth/delete-account", { cookie, body: { password: "LongEnoughPassword1!" } }), env);
  assert.equal(deleted.status, 200);
  assert.equal(env.DB.accounts.size, 0);
  assert.equal(env.DB.sessions.size, 0);
  assert.match(deleted.headers.get("Set-Cookie"), /Max-Age=0/);
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
  const status = await worker.fetch(request("/api/auth/status", { method: "GET" }), env);
  assert.deepEqual(await status.json(), { customerEnabled: false, staffEnabled: true });

  const registration = await worker.fetch(request("/api/auth/register", {
    body: { name: "Test User", email: "production@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  assert.equal(registration.status, 503);
  assert.equal(env.DB.accounts.size, 0);

  const orderStatus = await worker.fetch(request("/api/orders/status", { method: "GET" }), env);
  assert.deepEqual(await orderStatus.json(), { enabled: false });

  const payload = { name: "Test User", phone: "08012345678", address: "Ibafo, Lagos", state: "Lagos", adultConfirmed: true, items: [{ name: "Jollof Rice", category: "Rice", quantity: 1 }] };
  const order = await worker.fetch(request("/api/orders", { body: payload }), env);
  assert.equal(order.status, 503);
  const preview = await worker.fetch(request("/api/orders/preview", { body: payload }), env);
  assert.equal(preview.status, 503);
});


test("customer profile endpoint returns only the authenticated customer's own record", async () => {
  const env = makeEnv();
  const first = await worker.fetch(request("/api/auth/register", {
    body: { name: "Customer One", email: "one@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  const second = await worker.fetch(request("/api/auth/register", {
    body: { name: "Customer Two", email: "two@example.com", phone: "08087654321", password: "LongEnoughPassword2!", adultConfirmed: true },
  }), env);
  const firstCookie = sessionCookie(first);
  const secondCookie = sessionCookie(second);

  const ownProfile = await worker.fetch(request("/api/auth/me?userId=attacker-controlled", { method: "GET", cookie: firstCookie }), env);
  assert.equal(ownProfile.status, 200);
  const ownData = await ownProfile.json();
  assert.equal(ownData.user.email, "one@example.com");
  assert.equal(ownData.user.name, "Customer One");
  assert.notEqual(ownData.user.email, "two@example.com");

  const secondProfile = await worker.fetch(request("/api/auth/me", { method: "GET", cookie: secondCookie }), env);
  assert.equal(secondProfile.status, 200);
  assert.equal((await secondProfile.json()).user.email, "two@example.com");
});

test("customer sessions and unauthenticated requests cannot read staff orders or audit logs", async () => {
  const env = makeEnv();
  const registration = await worker.fetch(request("/api/auth/register", {
    body: { name: "Customer One", email: "staff-boundary@example.com", phone: "08012345678", password: "LongEnoughPassword1!", adultConfirmed: true },
  }), env);
  const customerCookie = sessionCookie(registration);

  for (const cookie of [undefined, customerCookie]) {
    const orders = await worker.fetch(request("/api/staff/orders", { method: "GET", cookie }), env);
    const logs = await worker.fetch(request("/api/staff/logs", { method: "GET", cookie }), env);
    assert.equal(orders.status, 401);
    assert.equal(logs.status, 401);
  }
});
