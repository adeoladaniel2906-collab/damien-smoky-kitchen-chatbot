import assert from "node:assert/strict";
import { getChatbotReply } from "./reply.ts";

const conversations = [
  {
    name: "budget language",
    messages: [
      "I have 4k, what can I eat?",
      "What can I get for four thousand?",
      "I'm broke 😂 what can I eat?",
      "What food is within my budget?",
      "I only have 3000 naira.",
    ],
    expected: [
      "Amala & Gbegiri at ₦3,000.",
      "Amala & Gbegiri at ₦3,000.",
      "Amala & Gbegiri at ₦3,000.",
      "Amala & Gbegiri at ₦3,000.",
      "Amala & Gbegiri at ₦3,000.",
    ],
  },
  {
    name: "delivery language",
    messages: [
      "Do you guys deliver?",
      "Can you bring food to me?",
      "Do you deliver in Lagos?",
      "Can I get delivery?",
      "I want my food delivered.",
    ],
    expected: [
      "Yes, within Lagos State.",
      "Yes, within Lagos State.",
      "Yes, within Lagos State.",
      "Yes, within Lagos State.",
      "Yes, within Lagos State.",
    ],
  },
  {
    name: "location language",
    messages: [
      "Where are you guys?",
      "What's your address?",
      "Where is the shop?",
      "How do I find you?",
      "I'm new here, where are you located?",
    ],
    expected: [
      "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
      "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
      "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
      "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
      "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
    ],
  },
  {
    name: "menu language",
    messages: [
      "Show me your menu.",
      "What food do you sell?",
      "What do you have?",
      "What meals are available?",
    ],
    expected: [
      "available menu information",
      "available menu information",
      "available menu information",
      "available menu information",
    ],
  },
  {
    name: "price language",
    messages: [
      "How much is jollof?",
      "How much is the cheapest?",
      "What's your most expensive meal?",
      "How much is amala?",
      "How much money do I need for jollof?",
    ],
    expected: [
      "Jollof Rice Combo Basic at ₦7,000",
      "Amala & Gbegiri — ₦3,000.",
      "Jollof Rice Combo Full Dish — ₦15,000.",
      "Amala & Gbegiri is ₦3,000.",
      "Jollof Rice Combo Full Dish at ₦15,000",
    ],
  },
  {
    name: "order language",
    messages: [
      "I want to order.",
      "How can I order?",
      "Can I order on WhatsApp?",
      "I want to buy amala.",
      "I want jollof.",
    ],
    expected: [
      "website or WhatsApp",
      "website or WhatsApp",
      "website or WhatsApp",
      "website or WhatsApp",
      "website or WhatsApp",
    ],
  },
  {
    name: "drink language",
    messages: [
      "What drinks do you have?",
      "What can I drink with my food?",
      "Give me a drink recommendation.",
      "What's your cheapest drink?",
    ],
    expected: ["Zobo", "Zobo", "Zobo", "Prices aren't currently available."],
  },
  {
    name: "restaurant facts and bounded unknowns",
    messages: [
      "What time do you open?",
      "Do you deliver outside Lagos?",
      "What are the ingredients?",
      "What is your delivery fee?",
      "Do you have vegan meals?",
      "What delivery time should I expect?",
    ],
    expected: [
      "9:00 AM–9:00 PM",
      "outside Lagos State isn't available",
      "isn't currently available",
      "isn't currently available",
      "isn't currently available",
      "isn't currently available",
    ],
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