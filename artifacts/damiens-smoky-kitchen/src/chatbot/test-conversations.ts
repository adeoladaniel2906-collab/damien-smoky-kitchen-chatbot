import assert from "node:assert/strict";
import { getChatbotReply } from "./reply.ts";

const conversations = [
  {
    name: "menu prices",
    messages: ["How much is amala?", "What is the price of shawarma?"],
    expected: ["Amala & Gbegiri is ₦3,000.", "Shawarma is ₦4,000."],
  },
  {
    name: "budget recommendation",
    messages: ["I have ₦5,000, what can I eat?", "Anything affordable for 4k?"],
    expected: ["Amala & Gbegiri at ₦3,000.", "Amala & Gbegiri at ₦3,000."],
  },
  {
    name: "restaurant information",
    messages: [
      "What time do you open?",
      "How do I place an order?",
      "Do you deliver outside Lagos?",
      "Where are you located?",
      "What is your WhatsApp number?",
    ],
    expected: [
      "9:00 AM–9:00 PM",
      "website or WhatsApp",
      "outside Lagos State isn't available",
      "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
      "080 3220 1672",
    ],
  },
  {
    name: "proposed drinks",
    messages: ["What drinks do you have?", "Recommend a beverage"],
    expected: ["Zobo", "Chapman", "Malt", "Bottled Water"],
  },
  {
    name: "unknown information stays bounded",
    messages: ["What are the ingredients?", "What is your delivery fee?"],
    expected: ["isn't currently available", "isn't currently available"],
  },
];

for (const conversation of conversations) {
  for (const [index, message] of conversation.messages.entries()) {
    const reply = getChatbotReply(message);
    const expected = conversation.expected[index];
    assert.ok(
      reply.includes(expected),
      `${conversation.name} failed for "${message}". Got: ${reply}`,
    );
  }
  console.log(`PASS ${conversation.name}`);
}