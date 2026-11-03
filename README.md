# Damien's Smoky Kitchen Website

A React restaurant website, customer account experience and kitchen assistant for Damien's Smoky Kitchen in Ibafo, Ogun State, Nigeria.

## Architecture

- **Frontend:** React 19, TypeScript, Vite and Wouter.
- **Customer identity:** Clerk React components for sign-up/sign-in, including Google sign-in when enabled in the Clerk instance.
- **Backend:** Cloudflare Worker serves the React assets and owns chat, customer-profile, staff-authentication and order APIs.
- **Customer profile mapping:** the Worker verifies Clerk sessions with the official `@clerk/backend` SDK. It requires a verified primary email and maps the Clerk user ID to a D1 customer profile. Existing profiles are linked only when the verified email matches and the row has no Clerk identity attached.
- **Staff identity:** separate password + TOTP authentication. Staff accounts do not use customer Clerk sessions.
- **Chat:** bounded request validation, rate limiting, deterministic restaurant knowledge and Workers AI fallback. The assistant must not invent menu prices, delivery fees, ingredients or policies.
- **Orders:** order creation remains disabled. `ORDERS_ENABLED=false` until customer-owned order records, staff access controls and the NDPA, processor, transfer and retention release gates are complete. The restaurant must confirm availability and delivery fee; the site does not collect online card payments.
- **Data:** D1 databases are restricted to the EU jurisdiction and read replication is disabled. This is a data-location control, not a substitute for the required Nigeria Data Protection Act cross-border transfer assessment and processor agreements.
- **Secrets:** keep credentials in Cloudflare Worker secrets. Never put secret keys in Vite variables, frontend code, commits or logs.

## Development

Requires Node.js 22 and pnpm.

```sh
pnpm install
pnpm --filter @workspace/damiens-smoky-kitchen dev
```

Build, typecheck and test:

```sh
pnpm --filter @workspace/damiens-smoky-kitchen typecheck
pnpm --filter @workspace/damiens-smoky-kitchen test
pnpm --filter @workspace/damiens-smoky-kitchen build
```

The Worker regression tests use Node's built-in test runner and TypeScript stripping. GitHub Actions runs typechecking, application tests, production dependency auditing, Wrangler configuration dry-runs, dependency review and CodeQL. Cloudflare Workers Builds performs preview and production deployments.

## Clerk and Cloudflare configuration

| Setting | Cloudflare configuration | Purpose |
|---|---|---|
| `CLERK_SECRET_KEY` | Worker **Secret** | Server-side Clerk session verification. Never expose it. |
| `CLERK_PUBLISHABLE_KEY` | Worker **plain-text variable** | Public Clerk instance key used by the Worker SDK. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vite build-time define in `vite.config.ts` | Same public key for the browser ClerkProvider. Safe to publish. |
| `CUSTOMER_AUTH_ENABLED` | Plain-text variable: `true` | Enables customer sign-in only when both Clerk keys and required bindings exist. |
| `STAFF_AUTH_ENABLED` | Plain-text variable: `true` | Enables the separate staff password + TOTP flow when all staff credentials are configured. |
| `ORDERS_ENABLED` | Plain-text variable: `false` | Keeps order submission disabled until the ownership and privacy gates are complete. |

Do not store the feature flags as secrets or JSON objects. The publishable key is public; only the Clerk secret key belongs in Secrets.

The Clerk React sign-up flow supports the providers enabled in the Clerk Dashboard. The current publishable key points to the configured Clerk development instance. Before public production customer traffic, switch to a Clerk production instance and its matching production secret and publishable keys.

## Cloudflare resources and migrations

The Wrangler configuration references:
- Production D1: `damien-smoky-kitchen-orders-eu`
- Preview D1: `damien-smoky-kitchen-orders-preview-eu`

Both databases use the EU jurisdiction and read replication is disabled.

The additive migration `0006_add_clerk_customer_identity.sql` adds a unique nullable Clerk user ID to customer profiles. The Cloudflare preview build applies migrations to the preview D1 database before publishing the preview. The production build applies pending migrations to the production D1 database before deploying the Worker. If migration application fails, the deployment command stops before publishing new Worker code.

## Customer and staff account behavior

- Customer sign-up and sign-in are handled by Clerk. Email must be verified before the Worker creates or links a D1 customer profile.
- New customer profiles collect a phone number and adult confirmation after Clerk sign-in.
- Existing customer profiles are linked only by verified primary email and only when the profile is not already linked to another Clerk user.
- Legacy password-based customer registration/login endpoints are disabled.
- Staff authentication remains separate and requires the configured staff email, password hash and valid TOTP secret.
- Customer account deletion is not yet wired to Clerk reverification. The account page directs deletion requests to the restaurant until that flow is implemented.
- Order history and order submission remain unavailable until each order is linked to its authenticated customer and staff roles are appropriately restricted.

## Privacy and consumer information

The site includes:
- Cookie consent with Accept all, Reject optional and saved preferences.
- A persistent Manage cookies control.
- Privacy, Cookie and Ordering Terms pages.
- Adult confirmation for customer profile completion and order submission. A parent/legal guardian must place a child's order using the adult's own details.

Optional analytics and marketing trackers are not currently loaded. If a tracker is added, it must be gated on the corresponding saved consent preference before it is loaded.

Before collecting live customer orders, the business must confirm the legal data-controller identity, processor agreements, cross-border transfer safeguards, privacy-request handling, retention operations and any required DPO arrangements. Tax transaction records must be retained as required by section 31(5) of the Nigeria Tax Administration Act 2025.

## Release checklist

- [x] Configure Clerk React and Worker SDKs.
- [x] Keep customer and staff authentication separate.
- [x] Verify customer Clerk sessions server-side and require verified email.
- [x] Add unique D1 mapping from customer profile to Clerk user ID.
- [x] Keep order submission disabled until customer ownership and staff authorization are complete.
- [x] Run typecheck, Worker tests, production build, Wrangler dry-run, dependency review and CodeQL.
- [ ] Confirm the production D1 identity migration and production Worker deployment complete successfully.
- [ ] Run a live browser sign-up/login test with the configured Clerk instance.
- [ ] Complete Clerk production-instance setup before public customer traffic.
- [ ] Implement Clerk reverification-based account deletion.
- [ ] Implement customer-owned orders and role-based staff access before enabling `ORDERS_ENABLED`.
- [ ] Confirm the NDPA processor contracts and cross-border transfer mechanism before collecting live orders.
- [ ] Review privacy notice, age process, terms, allergen information and refund/cancellation procedures with the business.
- [ ] Confirm production monitoring, rollback and backup procedures.

A successful build or website deployment is not approval to enable order collection. Keep `ORDERS_ENABLED=false` until the remaining release gates are independently verified.
