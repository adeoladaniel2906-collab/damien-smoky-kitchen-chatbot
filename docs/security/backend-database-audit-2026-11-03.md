# Backend and D1 Security Audit

**Date:** 2026-11-03  
**Repository:** `adeoladaniel2906-collab/damien-smoky-kitchen-chatbot`  
**Reviewed production Worker:** `damien-smoky-kitchen-chatbot54`  
**Reviewed D1 database:** `damien-smoky-kitchen-orders-eu`  
**Scope:** Source review, Wrangler configuration review, production D1 metadata/schema/migration inspection, and Cloudflare Worker secret-name inventory. This is not a penetration test or a legal compliance certification.

## Executive summary

The application has meaningful security controls: Clerk server-side identity verification, verified-email checks, a unique Clerk-user mapping, parameter-bound SQL in the inspected handlers, staff password plus TOTP, TOTP replay protection, secure/HttpOnly/SameSite staff session cookies, origin checks on state-changing browser endpoints, rate-limit bindings, security headers, D1 constraints/indexes, and an order feature flag that is currently configured off.

**Do not enable live order collection yet.** The order model and handler do not establish authenticated customer ownership. The order endpoint's readiness check confirms that Clerk is configured, but the create/preview handlers do not authenticate the caller or bind an order to a Clerk customer. The production flag currently prevents the path from being used, which is an important fail-closed control. The current Clerk configuration also points to a development instance.

## Confirmed findings

### B-01 — High: Order records have no customer ownership relationship

**Evidence:** `migrations/0001_create_orders.sql` defines `orders` without a `customer_id` or Clerk subject column. `src/worker.ts` `handleOrderCreate` inserts customer name, phone and address but no authenticated identity. `onlineOrderingAvailable` checks feature flags and Clerk configuration, not the request's authenticated user.

**Impact:** If `ORDERS_ENABLED` is switched on, a caller who can send a same-origin-looking request can submit an order without proving a customer identity. The Origin header is not an authentication credential and can be forged by non-browser clients. The idempotency key is global rather than scoped to an authenticated customer.

**Required remediation:** Verify Clerk identity on every create/preview request; require verified email and an existing profile; add a non-null customer foreign key to new orders; scope idempotency to customer plus key; return only the caller's own order data; test unauthenticated, cross-customer and replay cases. Keep `ORDERS_ENABLED=false` until fixed and independently verified.

### B-02 — High release blocker: Production Clerk configuration is a development instance

**Evidence:** `wrangler.jsonc` and `vite.config.ts` contain a `pk_test_` publishable key for `wired-monitor-3464.clerk.accounts.dev`. The CSP allowlist also names that development Clerk origin. The README explicitly says a Clerk production instance and matching keys are required before public customer traffic. Cloudflare metadata confirms a `CLERK_SECRET_KEY` secret exists, but its value was not accessed.

**Impact:** Development-instance configuration is not an acceptable production identity setup for public customer accounts. It may have development limits and test-mode behavior, and the browser/server keys must belong to the same production Clerk instance.

**Required remediation:** Create/confirm the production Clerk instance, configure its matching publishable and secret keys through the correct Cloudflare/Vite configuration, update CSP origins narrowly, configure allowed origins/redirect URLs and production email verification, then run real sign-up/sign-in/logout/revocation tests. Never paste secret values into GitHub or chat.

### B-03 — High privacy gap: Account deletion endpoint is not implemented

**Evidence:** `src/worker.ts` returns HTTP 501 from `/api/auth/delete-account`. README says deletion must be handled through a verified Clerk account-management flow and directs users to contact the restaurant.

**Impact:** There is no complete in-product verified deletion workflow for the Clerk identity and associated D1 profile. Deleting only one side could leave orphaned personal data or break audit/legal retention obligations.

**Required remediation:** Implement step-up/reverification, coordinated Clerk and D1 deletion/de-identification, order/tax-record retention exceptions, audit events without unnecessary PII, retry/reconciliation handling, and a documented support route. Do not delete legally required transaction records blindly.

### B-04 — Medium: Staff access is one configured identity, not role-based access control

**Evidence:** `STAFF_EMAIL`, `STAFF_PASSWORD_HASH` and `STAFF_TOTP_SECRET` configure one staff identity. `handleStaffOperations` authorizes any valid `staff` session for both order/PII reads and log reads. There are no staff roles or per-action permissions in the inspected schema/handler.

**Impact:** This is a single-operator design, not a safe foundation for multiple staff members with different duties. Every valid staff session can read customer names, phone numbers and delivery addresses.

**Required remediation:** Before adding staff accounts, introduce individual staff identities, explicit roles/permissions (least privilege), staff lifecycle/revocation, and tests proving kitchen, delivery, manager and admin permissions. Limit PII to staff who need it.

### B-05 — Medium: Privacy and audit-log retention controls are not implemented in the inspected code

**Evidence:** `staff_audit_logs` has a timestamp and an index, but the inspected Worker only writes order-status transitions and reads the latest 100 records. No retention/deletion job or documented retention enforcement was found in the inspected source. The account-deletion route is also not implemented.

**Impact:** Audit history can grow without an application retention policy, while privacy requests and tax-record retention need to be reconciled deliberately.

**Required remediation:** Define retention by data class, implement a tested scheduled cleanup/archival policy, retain statutory records only as required, and avoid storing customer PII in operational logs.

### B-06 — Medium: Staff mutation protection depends on exact Origin checks and SameSite cookies

**Evidence:** Staff order PATCH and auth mutations require exact same-origin Origin headers; the session cookie is HttpOnly, Secure, SameSite=Lax. No explicit CSRF token mechanism is present.

**Impact:** The current layered checks are useful for browser traffic, but Origin can be absent or forged by non-browser clients and SameSite behavior alone is not a complete authorization model. All mutation endpoints need to retain server-side session/role checks and strict request validation.

**Required remediation:** Keep exact Origin/Host validation, consider a synchronizer/double-submit CSRF token if cross-site use cases emerge, reject unexpected content types, and add negative tests for missing Origin, cross-origin, malformed requests and stale sessions.

### B-07 — Low/Medium: Production security observability is enabled but sampling/retention needs a privacy review

**Evidence:** Cloudflare Worker settings report observability enabled, logs persisted with 0.1 head sampling, query-string redaction enabled, invocation logs disabled; traces are not persisted. The source logs generic error labels in the reviewed authentication/order paths.

**Impact:** This is better than verbose PII logging, but sampling, log retention, access permissions, and accidental payload/exception logging still need an explicit review.

**Required remediation:** Verify log retention and who can read logs, keep request bodies/tokens/customer details out of logs, and test error paths for accidental sensitive-data exposure.

## Positive controls observed

- Production D1 is configured with EU jurisdiction; Cloudflare metadata reports region EEUR and read replication disabled.
- Production D1 has seven application/system tables plus Cloudflare's internal table. Migrations 0001–0006 are recorded as applied.
- Read-only `PRAGMA foreign_key_check` returned no violations.
- D1 schema includes unique customer email and a partial unique index on non-null Clerk user IDs.
- Order/item schema includes length, quantity, price, status and Lagos-state checks; order-item foreign key uses `ON DELETE CASCADE`.
- Inspected application SQL uses D1 `prepare(...).bind(...)` for user-controlled values.
- Staff TOTP replay state is stored and updated conditionally; repeated accepted TOTP time steps are rejected.
- Staff session tokens are random, stored as SHA-256 hashes, and delivered in an HttpOnly/Secure/SameSite=Lax `__Host-` cookie with a seven-day expiry.
- Cloudflare secret inventory contains names for Clerk secret key and staff credentials. Secret values were not read or displayed.
- Wrangler keeps `ORDERS_ENABLED=false`; production order creation currently fails closed.
- Security response headers include CSP, nosniff, frame denial, referrer policy and permissions policy.

## Database review

Production D1 schema and migration metadata were inspected read-only. No customer/order rows or record contents were queried or exported. The live schema includes:
- `orders`, `order_items`
- `customer_accounts`, `auth_sessions`
- `staff_totp_state`, `staff_audit_logs`
- Cloudflare-managed `d1_migrations` and internal `_cf_KV`

The production database reports EU jurisdiction, region EEUR, read replication disabled, 110,592 bytes and seven non-internal application tables. All six project migrations are recorded as applied. Foreign-key check returned no violations. These facts do not establish backups/restore readiness, legal transfer compliance, or production data accuracy.

## Required verification before closing this audit

- Run the complete test suite and add security regression tests for each finding.
- Inspect all API routes, every migration, dependency lockfile and CI workflow end-to-end.
- Verify actual Cloudflare production and preview bindings/variables, allowed origins, deployment history and rollback path without exposing secret values.
- Review account roles, API-token scopes, MFA and recovery access in Cloudflare; this audit did not establish those account-level controls.
- Verify D1 backup/Time Travel settings and perform a restore rehearsal in a non-production database.
- Verify Clerk production configuration and session lifecycle.
- Confirm privacy controller identity, processor agreements, international-transfer safeguards, retention schedule and deletion workflow with the business/legal owner.
- Perform controlled dynamic authorization and abuse testing against a preview environment using synthetic accounts and synthetic records only.

## Safety boundary

No production writes, migrations, configuration changes, secret reads, customer-row reads, exports, or penetration tests were performed for this report. The order feature flag must remain disabled until B-01 and the separate online-ordering audit's release gates are closed.
