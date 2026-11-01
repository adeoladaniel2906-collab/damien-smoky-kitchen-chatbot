# Damien's Smoky Kitchen Chatbot

A React restaurant website and customer chatbot for Damien's Smoky Kitchen in Ibafo, Ogun State, Nigeria.

## Architecture

- **Frontend:** React and TypeScript, built with Vite.
- **Backend:** Cloudflare Worker serves the React assets and owns `POST /api/chat`.
- **Chat flow:** request validation → Cloudflare rate limiting → deterministic answers from the restaurant knowledge base → Workers AI fallback for questions that need language reasoning.
- **Knowledge boundary:** replies must use the supplied restaurant facts. Unknown prices, delivery fees, delivery times, ingredients, and policies are not guessed; customers are directed to WhatsApp.
- **AI credentials:** Workers AI uses the Cloudflare binding. No provider credential is shipped to the browser.

Restaurant facts in the app: Ibafo, Ogun State; Lagos State delivery only; 9 AM–9 PM; ₦3,000 minimum delivery order; delivery fees vary by distance. Confirm any additional operational claims against the official restaurant source before adding them.

## Development

Requires Node.js and pnpm.

```sh
pnpm install
pnpm --filter @workspace/damiens-smoky-kitchen dev
```

Build and typecheck:

```sh
pnpm --filter @workspace/damiens-smoky-kitchen typecheck
pnpm --filter @workspace/damiens-smoky-kitchen build
```

## Cloudflare deployment

From `artifacts/damiens-smoky-kitchen`:

```sh
pnpm exec wrangler dev
pnpm exec wrangler deploy
```

The Worker requires the Workers AI binding and a Cloudflare Rate Limiting binding configured in `wrangler.jsonc`. Configure that binding in the target Cloudflare account before deployment. The current rule allows 20 requests per key per minute. The key uses the client IP supplied by Cloudflare.

The frontend and Worker must be deployed together so `/api/chat` reaches the Worker. Do not put secrets in Vite variables or client-side code.

## Chat API

Send a JSON body with a bounded `messages` array containing only `user` and `assistant` roles. System instructions are owned by the Worker and client-supplied system messages are rejected. Successful responses are UTF-8 plain text; validation and rate-limit failures return JSON errors.

## Project layout

- `artifacts/damiens-smoky-kitchen/src` — React application, chatbot knowledge and Cloudflare Worker.
- `artifacts/damiens-smoky-kitchen/wrangler.jsonc` — Worker, AI, assets and rate-limit bindings.
- `artifacts/api-server` and root Vercel configuration — legacy deployment artifacts; Cloudflare is the canonical chatbot deployment described here.

## Security

Never commit API credentials, customer information, or local environment files. Keep rate limits enabled in production, review Cloudflare logs for safe metadata only, and do not log chat contents or provider secrets.
