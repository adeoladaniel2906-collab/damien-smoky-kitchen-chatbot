# Merchant-ready online ordering preparation

**Status:** Preparation blueprint; not a production launch approval.  
**Default deployment model:** one independent website deployment per restaurant buyer (not a shared multi-tenant SaaS).  
**Recommended payment provider:** Paystack, subject to the merchant opening and verifying their own account.

## Product goal

Package this restaurant website so it can be handed to another restaurant with a controlled onboarding process. The buyer should be able to provide their own identity, branding, menu, contact details, delivery policy, payment account and domain without receiving another merchant's customer data or credentials.

Each buyer gets a separate Cloudflare Worker, D1 database, Clerk application/instance, domain and payment-provider account. Do not put multiple restaurants into the current single-tenant D1 database. A future multi-tenant SaaS would need a different tenant-isolation architecture and a separate security review.

## Recommended payment decision

Use **Paystack first** for Nigerian restaurant merchants.

Reasons:
- Local NGN pricing published as 1.5% + ₦100, with the ₦100 waived below ₦2,500 and local transaction fees capped at ₦2,000 (verify the merchant's current dashboard terms before launch).
- Nigerian customers can use supported local payment channels such as cards, bank transfer and USSD, subject to the merchant's dashboard activation and channel availability.
- Hosted checkout/redirect keeps card entry on the provider's payment page; the website must never collect or store card numbers, CVV or PIN.
- Server-side transaction initialization, verification and signed webhooks fit the existing Cloudflare Worker architecture.

Official references:
- Pricing: https://paystack.com/pricing
- Accept payments: https://paystack.com/docs/payments/accept-payments/
- Verify payments: https://paystack.com/docs/payments/verify-payments/
- Webhooks: https://paystack.com/docs/payments/webhooks/
- Payment channels: https://paystack.com/docs/payments/payment-channels/

Flutterwave is a valid alternative if a buyer specifically needs its supported channels or international reach. Its published Nigeria local collection rate is 2% (1.4% transaction fee + 0.6% platform fee), and the pricing page says fees are subject to 7.5% VAT. Compare the merchant's actual settlement and account terms before choosing it. Official pricing: https://flutterwave.com/ng/pricing/

### Payment UX recommended for restaurants

- Default: Pay online with Paystack (card, bank transfer and other merchant-enabled channels).
- Optional: Pay on delivery, only if the merchant accepts the fraud and collection risk.
- Do not offer direct-to-personal-account bank transfer as an unverified manual workflow.
- Never mark an order paid from a browser redirect alone.
- Do not accept client-supplied totals, delivery charges, payment status, provider references or customer IDs as authoritative.

## Order lifecycle target

1. Customer signs in with a verified email and has a server-side customer profile.
2. Server validates the cart against the current menu and calculates the subtotal using integer NGN values.
3. Server obtains or records a delivery quote. The customer sees and accepts the complete total before payment.
4. Server creates a pending order with customer ownership and a canonical request hash.
5. Server initializes Paystack with a unique transaction reference, amount in kobo, NGN currency, and metadata containing only the opaque order ID.
6. Customer completes checkout on Paystack's hosted page.
7. Server verifies the transaction reference with Paystack and checks successful status, exact amount, currency, reference, order ownership and expected payment state.
8. Signed Paystack webhook is verified using HMAC SHA-512 against the exact raw request body. Webhook events are idempotently recorded; replayed events cannot fulfil an order twice.
9. Order becomes paid only after server-side verification. Staff then accept/reject and progress the order.
10. Customer sees only their own order status. Staff see only fields required for their role.

## Technical implementation gates

The current application is not ready to collect live orders. The following work must be completed and regression-tested before enabling the order feature:

- Add customer ownership to orders with a D1 foreign key.
- Require a verified Clerk identity and mapped customer profile on order preview/create.
- Scope duplicate/idempotency behavior to the authenticated customer and a canonical payload hash.
- Add a customer-owned order detail/status endpoint with no IDOR.
- Add a dedicated rate-limit policy for order preview/create/payment initialization.
- Calculate all prices and delivery charges on the server; require customer acceptance of a final total.
- Add payment state and provider reference columns plus an idempotent webhook event ledger.
- Implement Paystack server-side initialization, transaction verification and raw-body webhook signature validation.
- Enforce exact amount, currency, reference, order state and customer/order binding checks.
- Implement cancellation/refund states and staff status transition permissions.
- Add per-role staff permissions and limit exposure of phone/address data.
- Complete account deletion/reverification and privacy retention workflows.
- Keep order and payment data out of caches, analytics, logs and client storage.
- Run unit, integration, concurrency and negative authorization tests with synthetic users in preview D1.
- Complete an independent security review before enabling production order submission.

## Merchant onboarding checklist

### Identity and branding
- Legal business name and trading name.
- Logo, brand colours, real food/restaurant photography and menu copy.
- Business phone, WhatsApp, support email and physical address.
- Public domain selected and owned by the merchant.
- Privacy contact and named data controller.

### Menu and delivery
- Menu items with stable IDs, names, categories, descriptions, dietary/allergen details, current prices and availability.
- Minimum order value.
- Delivery areas and exclusions.
- Delivery fee calculation or staff quote workflow.
- Estimated delivery windows and opening hours.
- Cancellation, refund, unavailable-item and substitution policies.

### Accounts and infrastructure
- Merchant-owned Cloudflare account and Worker/D1 resources.
- Merchant-owned production Clerk application with production domain and matching production keys.
- Merchant-owned Paystack account, verified business profile and settlement bank account.
- Test and live Paystack keys stored only as Cloudflare Worker secrets.
- Separate preview and production databases.
- Domain DNS, HTTPS, redirects and security headers.
- Backup/restore rehearsal and a documented rollback procedure.

### Operations
- Owner/admin identity and recovery process.
- Named staff accounts and role assignments.
- Staff MFA and access revocation process.
- Order acceptance and preparation workflow.
- Delivery assignment and proof-of-delivery procedure.
- Customer support and dispute/refund handling.
- Monitoring, incident response and data-subject request procedure.

## Costs the buyer should budget for

These are service costs, not a fixed quote. Check live pricing before purchasing.

- **Custom domain:** paid yearly. Cloudflare Registrar sells supported domains at registry/ICANN cost; the displayed .com price was approximately US$11.17/year when this preparation note was written. The exact TLD and availability change the price. https://pricing.registrar.cloudflare.com/
- **Clerk:** the current Hobby tier is free but includes Clerk branding and has a 7-day session lifetime. Clerk Pro removes Clerk branding and adds production features; the current pricing page lists US$20/month when billed annually (monthly billing may be higher). If the buyer insists on removing Clerk branding, budget for Pro. https://clerk.com/pricing
- **Paystack:** no monthly subscription is assumed here; payment processing fees are deducted per successful transaction according to the merchant's current agreement and enabled channels. https://paystack.com/pricing
- **Cloudflare:** DNS/SSL and some hosting capabilities are available on the Free plan, but Worker/D1 usage, limits and any paid add-ons must be checked against the expected traffic and current plan. https://www.cloudflare.com/plans/
- **Email/SMS/WhatsApp:** optional provider charges depend on the selected service and message volume.
- **App stores:** not required for this web-ordering launch. Google Play and Apple Developer account fees are a separate later budget.

## Required merchant decisions before the implementation is finalized

The defaults below are recommended for a typical Nigerian restaurant deployment. The buyer must confirm them before live launch.

| Decision | Recommended default |
|---|---|
| Customer checkout | Sign-in required; verified email |
| Currency | NGN |
| Payment | Paystack hosted checkout |
| Payment channels | Card + bank transfer; enable USSD if useful |
| Cash on delivery | Optional, disabled by default |
| Delivery quote | Staff-confirmed quote until reliable zones/rates are supplied |
| Delivery coverage | Explicitly configured per buyer |
| Staff | Separate accounts with least-privilege roles |
| Hosting | Separate Cloudflare resources per restaurant |
| Identity | Separate production Clerk instance per restaurant |

## Explicit non-goals

- Do not enable the current production order flag as part of preparation.
- Do not use Damien's production Paystack/Clerk credentials for another buyer.
- Do not place secret keys in Vite, React, GitHub, screenshots or chat.
- Do not claim the site is legally compliant based only on this technical checklist.
- Do not reuse the existing D1 database for a second restaurant.
- Do not begin the Chrome PWA task in this workstream.
