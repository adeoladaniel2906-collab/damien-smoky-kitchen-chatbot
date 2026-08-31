---
name: Chatbot knowledge boundary
description: Safety and routing rules for the restaurant's controlled local chatbot.
---

The restaurant chatbot should answer only from the explicitly provided knowledge base. Specific missing details such as fees, delivery times, prices, ingredients, drinks, and payment methods must not be inferred; the reply should say the information is unavailable and provide the restaurant phone number.

**Why:** The prototype is intentionally controlled before a real AI model is connected, so confident guesses would be more harmful than a clear handoff.

**How to apply:** When expanding the knowledge base or its matcher, add facts to the source data first, keep specific unknown-topic handlers ahead of broad menu/keyword handlers, and preserve budget-aware recommendations using only priced items.