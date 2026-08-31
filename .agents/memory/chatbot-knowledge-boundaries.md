---
name: Chatbot knowledge boundary
description: Safety and routing rules for the restaurant's controlled local chatbot.
---

The restaurant chatbot should answer only from the explicitly provided knowledge base. Specific missing details such as fees, delivery times, prices, ingredients, drinks, and payment methods must not be inferred; the reply should say the information is unavailable and provide the restaurant phone number.

**Why:** The prototype is intentionally controlled before a real AI model is connected, so confident guesses would be more harmful than a clear handoff.

**How to apply:** When expanding the knowledge base or its matcher, add facts to the source data first, keep specific unknown-topic handlers ahead of broad menu/keyword handlers, and preserve budget-aware recommendations using only priced items.

The direct OpenAI integration can be correctly configured while requests still fail with a provider-side `429 credit_balance_exhausted`; keep that distinct from missing-secret or application errors.

**Why:** A live request reached OpenAI and was rejected for account credits, so treating every upstream failure as a code defect would lead to unnecessary changes.

**How to apply:** Log only safe provider metadata such as status, code, and type; return a generic retry message to customers and report account-credit failures accurately during verification.

For replaceable chatbot prototypes, keep the knowledge records as data and the natural-language dispatcher as a separate module; test the dispatcher with realistic multi-turn conversation fixtures.

**Why:** This makes it possible to replace the deterministic reply engine later without changing the chat UI or rewriting the restaurant facts.

**How to apply:** Keep business facts, aliases, and proposed catalog entries in one data module, keep matching/recommendation logic elsewhere, and expand the conversation fixtures whenever a new question variation is supported.