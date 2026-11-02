# Damien's Smoky Kitchen Website

A React restaurant website, guest-order request flow and customer assistant for Damien's Smoky Kitchen in Ibafo, Ogun State, Nigeria.

## Architecture

- **Frontend:** React and TypeScript, built with Vite.
- **Backend:** Cloudflare Worker serves the React assets and owns the chat, order-request and authentication APIs.
- **Chat:** bounded request validation, rate limiting, deterministic restaurant knowledge and Workers AI fallback. The assistant must not invent menu prices, delivery fees, ingredients or policies.
- **Orders:** the Worker can validate the current menu and price data, apply per-IP rate limits, require an idempotency key, and store pending order requests in D1. `ORDERS_ENABLED` defaults to `false` in both production and preview. While disabled, the checkout does not ask for customer name, phone or address, and the API rejects order submission before reading or storing customer details. Enable it only after the NDPA, processor, transfer and retention release gates are satisfied. The restaurant must confirm availability and delivery fee; the site does not collect online card payments.
- **Data:** D1 databases are restricted to the EU jurisdiction and read replication is disabled. This is a data-location control, not a substitute for the required Nigeria Data Protection Act cross-border transfer assessment and processor agreements.
- **Secrets:** keep credentials in Cloudflare Worker secrets/variables. Never put secrets in Vite variables, frontend code, commits or logs.

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

The Worker regression tests use Node's built-in test runner and TypeScript stripping. GitHub Actions also runs Wrangler's deployment dry-run and CodeQL static analysis.

## Cloudflare resources

The Wrangler configuration references:
- Production D1: `damien-smoky-kitchen-orders-eu`
- Preview D1: `damien-smoky-kitchen-orders-preview-eu`

Both databases are configured with the `eu` jurisdiction and read replication disabled. The preview schema has been applied and checked. The production database is intentionally not migrated or bound to the live Worker yet.

From `artifacts/damiens-smoky-kitchen`, preview migrations can be checked with:

```sh
pnpm exec wrangler d1 migrations list damien-smoky-kitchen-orders-preview-eu --config wrangler.preview-migrations.jsonc --remote
```

Do not apply production migrations or deploy until the release checklist is complete.

## Customer and staff account status

The site contains separate customer Create Account, Customer Login and Staff Login pages. They are **disabled by default** through server-side feature flags:
- `CUSTOMER_AUTH_ENABLED`
- `STAFF_AUTH_ENABLED`

The Worker returns an explicit unavailable status unless the corresponding flag is enabled. Customer registration cannot create staff privileges.

The current password implementation uses PBKDF2-HMAC-SHA-256 with 600,000 iterations, a unique random salt, a SHA-256 hash of each random session token in D1, and Secure, HttpOnly, SameSite=Lax cookies. It has per-IP and per-account rate limits. The production flags must remain off until:
1. The target Cloudflare runtime is benchmarked against its actual CPU limit.
2. Customer email verification and password-reset flows are implemented.
3. Staff MFA or a properly configured identity provider is in place.
4. The D1 and Worker bindings are deployed and tested together.

Cloudflare Workers Free allows 10 ms CPU time per HTTP request. Paid Workers have a substantially larger CPU budget. Do not reduce the password-hashing work factor to work around a plan limit. The staff hash utility is provided at `scripts/hash-staff-password.mjs`; it reads the password from standard input and must be run locally. The authenticator secret utility is `scripts/generate-staff-totp-secret.mjs`; run it locally with the authorised staff email, add the generated key to an authenticator app, and store the same key as the Cloudflare Worker secret `STAFF_TOTP_SECRET`. Never send either secret through chat or commit them.

## Privacy and consumer information

The site includes:
- A centred cookie-choice dialog with Accept all, Reject optional and saved preferences.
- A persistent Manage cookies control.
- Privacy, Cookie and Ordering Terms pages.
- An adult confirmation check for account registration and order submission. A parent/legal guardian must submit a child's order using the adult's own details.
- A customer account deletion endpoint that requires the current password and revokes that customer's sessions.

Optional analytics and marketing trackers are not currently loaded. If a tracker is added, it must be gated on the corresponding saved consent preference before it is loaded.

The privacy notice describes the current data categories and third-party providers. Before live customer data is collected, the business must confirm the legal data-controller identity, processor agreements, cross-border transfer safeguards, privacy-request handling, retention operations and any required DPO arrangements. Tax transaction records must be retained as required by section 31(5) of the Nigeria Tax Administration Act 2025; the site does not automatically delete legally required order records when an account is deleted.

## Release checklist

- [ ] Configure Cloudflare Worker D1, AI and all rate-limit bindings from `wrangler.jsonc`.
- [ ] Confirm the EU-restricted production D1 schema and migration history.
- [ ] Configure Cloudflare observability with privacy-minimised logs and query-string redaction.
- [ ] Complete a preview Worker deployment and browser/API end-to-end tests.
- [ ] Benchmark PBKDF2 on the actual Worker plan before enabling authentication.
- [ ] Implement and test customer email verification and password reset.
- [ ] Generate and enroll the staff TOTP secret, configure `STAFF_TOTP_SECRET` as a Cloudflare secret, apply migration 0004 and verify replay rejection before enabling staff access.
- [ ] Confirm the business's NDPA processor contracts and cross-border transfer mechanism before changing `ORDERS_ENABLED` from `false`.
- [ ] Review the privacy notice, cookie categories, age process, terms, allergen information and refund/cancellation procedures with the business.
- [ ] Confirm production domain, HTTPS, monitoring, rollback and backup procedures.
- [ ] Merge only after all required checks and release blockers are cleared.

No production deployment is authorised by this README. The release must be approved through the pull request and verified against the live Cloudflare environment.
