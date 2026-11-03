# Online Ordering Security and Readiness Audit

**Date:** 2026-11-03  
**Repository:** `adeoladaniel2906-collab/damien-smoky-kitchen-chatbot`  
**Scope:** Order preview/create API, order schema, basket/pricing validation, staff order operations, feature flags and release requirements. This is an initial evidence-based audit, not approval to enable ordering.

## Executive summary

**Online ordering is not ready for launch. Keep `ORDERS_ENABLED=false`.** The application currently has a preview/create implementation and D1 order tables, but the schema and handlers do not associate orders with an authenticated customer. The order-create handler checks the feature flag and Clerk configuration indirectly, but it does not authenticate the actual request. A same-origin Origin check is not proof of customer identity.

The website currently states that online card payment is not taken. The ordering design should therefore remain a restaurant-confirmed order request unless the business explicitly chooses and configures a payment provider.

## Confirmed findings

### O-01 — Critical release blocker: Order creation is not bound to an authenticated customer

**Evidence:** `src/worker.ts` `handleOrderCreate` calls `handleOrderPreview`, checks a caller-supplied `Idempotency-Key`, and inserts order fields. It does not call `getClerkIdentity`, require a customer profile, or attach a customer ID to the order. `migrations/0001_create_orders.sql` has no customer foreign key/Clerk subject column. `onlineOrderingAvailable` only checks feature flags and Clerk configuration.

**Impact:** If the order feature flag is enabled, an unauthenticated caller can potentially submit orders by crafting a request with an Origin header. Browser Origin checks do not stop scripts/non-browser clients from forging that header. There is no customer ownership boundary.

**Required remediation:** Require a verified Clerk identity on every preview/create request; map to the server-side customer profile; add a customer foreign key to orders; scope idempotency to the authenticated customer; ensure customer order reads can only return that customer's orders; test unauthenticated, cross-account, forged-Origin and replay attempts. Keep orders disabled until tests pass.

### O-02 — High: Idempotency is global and not tied to the customer or request payload

**Evidence:** `orders.idempotency_key` is globally UNIQUE. The handler returns the existing order ID/status/subtotal whenever a key already exists, without verifying that the caller owns the existing order or that the payload matches the original request.

**Impact:** A key collision/reuse can cause a caller to receive another request's order reference and misleading confirmation metadata. It also prevents a clean per-customer idempotency contract.

**Required remediation:** Scope uniqueness to customer ID plus idempotency key; persist a canonical request hash; return the original response only when the same authenticated customer repeats the same logical request; reject key reuse with a different payload.

### O-03 — High: No customer order-history or ownership endpoint exists

**Evidence:** The inspected staff endpoints expose recent orders to staff. No customer order lookup endpoint with ownership checks was found in the inspected Worker. The order table lacks a customer foreign key.

**Impact:** Customers cannot securely view their own order status, and a future implementation risks insecure direct object references (IDOR) if it looks up orders by ID alone.

**Required remediation:** Add customer-owned order lookup/status endpoints that always scope by authenticated customer ID; do not trust a customer ID supplied by the browser; use opaque IDs as defense-in-depth, not as authorization.

### O-04 — High: Staff order access is all-or-nothing

**Evidence:** `handleStaffOperations` requires a valid staff session, but any staff session can read customer name, phone, address and order details. The current authentication config represents one staff identity and has no role-specific authorization.

**Impact:** This is not sufficient if kitchen, delivery, customer service, managers or administrators receive separate logins. Each role should see only the data/actions required for its work.

**Required remediation:** Define roles and permissions, field-level PII exposure, status-transition permissions, staff account revocation, and audit events. Test each role against every endpoint.

### O-05 — Medium: Preview uses the chat rate limiter

**Evidence:** `handleOrderPreview` consumes `CHAT_RATE_LIMIT`; order creation consumes `ORDER_RATE_LIMIT` and then calls preview, which also consumes the chat limit.

**Impact:** Ordering traffic shares the chatbot quota, and create requests consume two different rate-limit buckets. This makes abuse controls harder to reason about and can unexpectedly throttle normal chat traffic.

**Required remediation:** Use a dedicated preview/order rate-limit policy, document the intended limits, and test IP and authenticated-customer limits. Add bot/abuse controls only after measuring legitimate traffic.

### O-06 — Medium: Price calculation is server-side, but basket canonicalization needs tests

**Evidence:** Preview and create resolve menu items by name/category and calculate prices from `restaurantKnowledge`, not from a client-supplied price. Quantity is limited to 1–20, basket size to 30, and minimum order is enforced. The database stores line totals and subtotal.

**Impact:** Server-side pricing is the correct direction. However, repeated duplicate lines, menu changes between preview and create, integer overflow/rounding boundaries, and canonical request consistency need explicit regression coverage.

**Required remediation:** Use stable menu item IDs, aggregate duplicate lines deterministically, calculate all money in integer NGN minor units/whole-naira units consistently, persist the authoritative unit price and menu version, and test stale menu, duplicate line, invalid quantity, boundary and subtotal mismatch cases.

### O-07 — Medium: Delivery fee is not calculated or confirmed by the system

**Evidence:** Preview returns `deliveryFee: null` and says the restaurant must confirm the delivery fee. Staff order list includes nullable `delivery_fee_ngn`.

**Impact:** This is honest and avoids inventing a delivery price, but the user cannot receive a final total or accept an order based on a confirmed delivery amount.

**Required remediation:** Define delivery zones/distance rules and authoritative fee calculation, or add a staff quote/confirmation step before the customer accepts. Store the fee, quote time, confirmer and final total. Do not charge or represent a final total before confirmation.

### O-08 — High release blocker: No payment integration or payment lifecycle exists

**Evidence:** README and basket UI state that no online card payment is taken. No payment provider/webhook implementation was identified in the reviewed Worker routes/schema.

**Impact:** If the business expects prepaid online orders, there is no safe payment flow. If it expects pay-on-delivery or bank transfer, the UI and state machine must make that explicit and reconcile payments manually.

**Required remediation:** Business must choose one: (a) no online payment/pay on delivery or confirmed transfer, or (b) a payment provider such as Paystack/Flutterwave. For online payment, implement server-created payment intents, signed webhook verification, idempotent event processing, amount/currency/order binding, refund handling, and never store raw card data. Store provider references and payment states only.

### O-09 — High privacy release blocker: Nigeria data protection and EU processing require business evidence

**Evidence:** Production D1 metadata confirms EU jurisdiction/region EEUR and read replication disabled. README explicitly says this is not a substitute for the Nigeria Data Protection Act cross-border transfer assessment and processor agreements.

**Impact:** Names, phone numbers, delivery addresses and order records are personal data. Database location alone does not establish lawful transfer, transparency, retention or processor controls.

**Required remediation:** Business must identify the data controller, provide privacy contact details, approve the lawful basis/purpose and retention schedule, document Cloudflare/Clerk processor terms and cross-border safeguards, define data-subject request handling, and confirm any DPO/registration obligations with qualified Nigerian privacy counsel.

## Existing safeguards observed

- `ORDERS_ENABLED=false` in Wrangler production configuration; order API fails closed while disabled.
- Exact same-origin Origin checks on create and preview routes.
- Request body size and field-length checks.
- Menu prices are looked up server-side; client-supplied price is not trusted.
- Minimum order and quantity/basket bounds are enforced.
- Idempotency key is required and the D1 column has a unique constraint.
- Order and item writes are grouped through D1 batch.
- D1 has status, length, quantity and foreign-key constraints.
- Staff endpoints require a server-side staff session and status transitions are constrained.
- Order/staff responses use `Cache-Control: no-store`.

These controls are useful but do not replace customer authentication/ownership, role-based access or payment verification.

## Required order contract from the business

Before implementation, confirm:
1. **Payment:** pay on delivery, bank transfer after restaurant confirmation, or online card/bank payment through a named provider.
2. **Delivery:** exact service areas (the current code only permits Lagos state), delivery-fee rules, minimum order and who confirms delivery availability.
3. **Order lifecycle:** pending, accepted, preparing, dispatched, completed, cancelled; define who may transition each state and what cancellation/refund rules apply.
4. **Customer requirements:** must every order require sign-in, or do you want guest checkout? The safer default is signed-in customers with verified email and a customer-owned order record.
5. **Customer communications:** order confirmation/status channels (website only, email, SMS, WhatsApp) and which provider/accounts are already used.
6. **Staff roles:** owner/admin, manager, kitchen, delivery and customer support; specify who may see phone/address, change status, set delivery fee, cancel and read audit logs.
7. **Retention/privacy:** controller legal name, public privacy contact, retention periods and processor/transfer agreements.

## Test plan before release

- Unauthenticated create/preview is rejected.
- Authenticated customer A cannot read, alter or infer customer B's orders.
- Forged Origin, missing Origin, CSRF and direct API requests are rejected as appropriate.
- Replayed idempotency key returns the same order only to the same customer and same payload.
- Different payload with reused key is rejected.
- Client-supplied prices, totals, fees, status, customer IDs and payment state are ignored/rejected.
- Invalid/duplicate menu lines and boundary quantities are handled deterministically.
- Concurrent duplicate requests create exactly one order.
- D1 batch failure leaves no partial order/items.
- Staff role matrix and every status transition are tested.
- Rate limiting, abuse controls, logging redaction and no-store behavior are tested.
- Payment webhook signature, amount, currency, replay and refund behavior are tested if online payments are selected.
- End-to-end synthetic order is verified in a non-production D1 database before production rollout.

## Safety boundary

This PR records the audit only. No production writes, feature-flag changes, migrations, payments, customer-row reads or exports were performed. Keep `ORDERS_ENABLED=false` until all critical/high findings and business/privacy release gates are closed.
