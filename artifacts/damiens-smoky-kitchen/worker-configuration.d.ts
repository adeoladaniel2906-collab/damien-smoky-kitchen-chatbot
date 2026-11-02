/// <reference types="@cloudflare/workers-types" />

// This file is generated and refreshed by `wrangler types` before typechecking.
// The bindings mirror artifacts/damiens-smoky-kitchen/wrangler.jsonc.
interface OrderDatabaseStatement {
  bind(...values: Array<string | number | null>): OrderDatabaseStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface OrderDatabaseBinding {
  prepare(query: string): OrderDatabaseStatement;
  batch(statements: OrderDatabaseStatement[]): Promise<unknown[]>;
}

interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  CHAT_RATE_LIMIT: RateLimit;
  ORDER_RATE_LIMIT: RateLimit;
  AUTH_RATE_LIMIT: RateLimit;
  STAFF_EMAIL?: string;
  STAFF_PASSWORD_HASH?: string;
  DB: OrderDatabaseBinding;
}
