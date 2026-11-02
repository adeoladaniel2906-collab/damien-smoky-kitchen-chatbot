/// <reference types="@cloudflare/workers-types" />

// This file is generated and refreshed by `wrangler types` before typechecking.
// The bindings mirror artifacts/damiens-smoky-kitchen/wrangler.jsonc.
interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  CHAT_RATE_LIMIT: RateLimit;
  ORDER_RATE_LIMIT: RateLimit;
  DB: D1Database;
}
