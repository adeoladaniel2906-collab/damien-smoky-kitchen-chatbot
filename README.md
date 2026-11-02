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


## Customer and staff authentication

The Worker provides separate customer and staff authentication:
- `/create-account` and `/login` are public customer account pages.
- `/staff-login` is the staff sign-in page. Public customer registration cannot create staff accounts.
- `/account` and `/staff` check the server-issued session and role.
- Passwords are hashed with PBKDF2-SHA-256 (310,000 iterations) and a per-account random salt. Session tokens are random, stored only as SHA-256 hashes in D1, and sent in Secure, HttpOnly, SameSite=Lax cookies.
- Authentication endpoints have a dedicated Cloudflare rate limit. Customer and staff roles are checked by the Worker, not trusted from the browser.

Before enabling staff login, configure these Worker variables/secrets in the Cloudflare dashboard:
- `STAFF_EMAIL`: the one authorised staff email address.
- `STAFF_PASSWORD_HASH`: the PBKDF2 hash generated locally as described below.

Generate the hash without putting the password in shell history (from the repository root):

```sh
read -s -p "Staff password: " STAFF_PASSWORD
printf '\\n'
printf %s "$STAFF_PASSWORD" | node scripts/hash-staff-password.mjs
unset STAFF_PASSWORD
```

Copy the generated hash into the Cloudflare Worker secret named `STAFF_PASSWORD_HASH`. Set `STAFF_EMAIL` as a Worker variable (or secret). Never put either value in Vite variables, source files, or GitHub commits.

Apply the new D1 migration to the preview database before preview authentication testing, then to production only when the release is approved:

```sh
cd artifacts/damiens-smoky-kitchen
pnpm exec wrangler d1 migrations apply damien-smoky-kitchen-orders-preview --config wrangler.preview-migrations.jsonc --remote
```

Customer account email ownership is not verified in this first implementation. Do not use account email as a high-assurance identity until an email verification or password-reset workflow is added. The staff portal currently verifies staff identity only; order-management actions are not exposed until separately implemented and protected.
