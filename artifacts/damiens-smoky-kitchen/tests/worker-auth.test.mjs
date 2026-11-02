import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import worker from "../src/worker.ts";

const b64url = (value) => Buffer.from(value).toString("base64url");

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
    AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
    AUTH_EMAIL_RATE_LIMIT: { limit: async () => ({ success: true }) },
    CHAT_RATE_LIMIT: { limit: async () => ({ success: true }) },
    ORDER_RATE_LIMIT: { limit: async () => ({ success: true }) },
    CUSTOMER_AUTH_ENABLED: "true",
    STAFF_AUTH_ENABLED: "true",
    STAFF_EMAIL: "staff@example.com",
    STAFF_PASSWORD_HASH: staffHash("StaffPassword!2026"),
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

test("order preview rejects an order without adult confirmation", async () => {
  const env = makeEnv();
  const response = await worker.fetch(request("/api/orders/preview", {
    body: { name: "Test User", phone: "08012345678", address: "Ibafo, Lagos", state: "Lagos", adultConfirmed: false, items: [{ name: "Jollof Rice", category: "Rice", quantity: 1 }] },
  }), env);
  assert.equal(response.status, 400);
});
