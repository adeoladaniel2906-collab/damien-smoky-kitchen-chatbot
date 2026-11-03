# Paystack integration contract

This document defines the secure provider contract for the online-ordering implementation. It is not a payment integration and does not enable payment collection.

## Provider choice

Paystack is the default provider for a Nigeria-first restaurant. The merchant owns the Paystack account and provides separate test/live credentials through Cloudflare Worker secrets.

## Configuration

Required Worker secret:
- `PAYSTACK_SECRET_KEY`

Required plain-text Worker variables:
- `PAYMENT_PROVIDER=paystack`
- `PAYMENTS_ENABLED=false` until preview tests, webhook configuration and merchant verification are complete.
- `PUBLIC_APP_ORIGIN=https://merchant-domain.example` (must match the deployed origin; do not trust a browser-supplied callback URL).

Do not define `PAYSTACK_SECRET_KEY` as a Vite variable or expose it to the browser. Do not commit real keys or paste them into chat.

Use Paystack test keys only in preview. Production must use a live key belonging to the restaurant's verified merchant account. A buyer must never receive the previous merchant's credentials.

## Required server routes

Proposed routes, to be implemented and tested in the ordering feature branch:

- `POST /api/payments/paystack/initialize`: requires verified customer identity and customer-owned pending order. Loads the final server-side total and email from D1/Clerk, generates a unique reference, converts NGN to kobo, calls Paystack from the Worker, and returns only the authorization URL/reference.
- `GET /api/payments/paystack/verify?reference=...`: authenticated customer can verify only their own order's reference. Server calls Paystack verification API; redirect query parameters are not proof of payment.
- `POST /api/payments/paystack/webhook`: accepts raw request bytes, verifies `x-paystack-signature` using HMAC SHA-512 and the secret key, validates event type, and performs idempotent processing.
- `GET /api/orders/:id`: requires customer identity and scopes query by authenticated customer ID.

## Mandatory verification

Before an order can be marked paid, server-side verification must confirm:
- Paystack API response is successful and transaction status is `success`.
- Reference equals the unique reference stored for the order/payment attempt.
- Amount equals the exact expected amount in kobo.
- Currency is `NGN`.
- The payment reference maps to the expected order.
- The order belongs to the authenticated customer.
- The order is still in a payable state and has not already been fulfilled/refunded.
- The payment event/reference has not already been applied.

## Webhook processing

- Verify HMAC SHA-512 over the exact raw request body, not a reserialized JSON object.
- Compare signatures in constant time.
- Reject invalid signatures without changing order/payment state.
- Store provider event IDs/references under a unique constraint to prevent replay.
- Re-query Paystack transaction verification for critical payment events before fulfilling an order.
- Process duplicate valid events idempotently.
- Never fulfil an order from a browser redirect or a client-side success message.
- Never log raw webhook payloads, authorization headers, secrets or full customer payment data.

## Payment states

Recommended states:
- `not_required` (explicit pay-on-delivery/manual-payment path only)
- `pending`
- `processing`
- `paid`
- `failed`
- `cancelled`
- `refunded`
- `partially_refunded`
- `disputed`

Order status and payment status must remain separate. A paid order can still be pending restaurant acceptance; a cancelled order may require a refund.

## Official references

- https://paystack.com/docs/payments/accept-payments/
- https://paystack.com/docs/payments/verify-payments/
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/payments/payment-channels/
- https://paystack.com/pricing
