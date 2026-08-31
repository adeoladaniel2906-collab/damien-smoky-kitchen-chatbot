/**
 * Controlled local chatbot knowledge base for Damien's Smoky Kitchen.
 *
 * This module deliberately contains no AI API calls. The chatbot must only
 * answer from the verified information below and must not fill gaps by
 * guessing.
 */
const menuItems = [
  {
    name: "Jollof Rice Combo Basic",
    price: 7000,
    aliases: ["jollof rice combo basic", "basic jollof"],
  },
  {
    name: "Jollof Rice Combo Full Dish",
    price: 15000,
    aliases: ["jollof rice combo full dish", "full jollof", "jollof full dish"],
  },
  { name: "Amala & Gbegiri", price: 3000, aliases: ["amala", "gbegiri"] },
  { name: "Pounded Yam", price: 4000, aliases: ["pounded yam"] },
  {
    name: "Chicken & Chips",
    price: 4000,
    aliases: ["chicken and chips", "chicken chips"],
  },
  { name: "Shawarma", price: 4000, aliases: ["shawarma"] },
  { name: "Grilled Chicken", price: null, aliases: ["grilled chicken"] },
];

const openingHours = "Our opening hours are 9:00 AM–9:00 PM.";
const location =
  "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State.";
const phone = "080 3220 1672";

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+(?=\d)/g, "$1")
    .trim();
}

function formatPrice(price) {
  return `₦${price.toLocaleString("en-NG")}`;
}

function unavailable(topic = "That information") {
  return `${topic} isn't currently available. Please call Damien's Smoky Kitchen on ${phone} for assistance.`;
}

function menuSummary() {
  return [
    "The available menu information is:",
    "Jollof Rice Combo Basic — ₦7,000",
    "Jollof Rice Combo Full Dish — ₦15,000",
    "Amala & Gbegiri — ₦3,000",
    "Pounded Yam — ₦4,000",
    "Chicken & Chips — ₦4,000",
    "Shawarma — ₦4,000",
    "Grilled Chicken — available; price isn't currently available.",
  ].join(" ");
}

function itemPrice(question) {
  if (question.includes("jollof")) {
    if (question.includes("full")) {
      return "Jollof Rice Combo Full Dish is ₦15,000.";
    }
    if (question.includes("basic")) {
      return "Jollof Rice Combo Basic is ₦7,000.";
    }
    return "Jollof Rice Combo Basic is ₦7,000, and Jollof Rice Combo Full Dish is ₦15,000.";
  }

  const match = menuItems.find(
    (item) =>
      item.price !== null &&
      item.aliases.some((alias) => question.includes(normalize(alias))),
  );

  return match ? `${match.name} is ${formatPrice(match.price)}.` : null;
}

function budgetFrom(question) {
  const thousandBudget = question.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (thousandBudget) {
    return Number(thousandBudget[1]) * 1000;
  }

  const nairaBudget = question.match(
    /(?:under|below|within|budget of)\s*([\d]+)/,
  );
  return nairaBudget ? Number(nairaBudget[1]) : null;
}

function recommendation(question) {
  const budget = budgetFrom(question);
  const prefersChicken = question.includes("chicken");
  const prefersJollof = question.includes("jollof");
  const prefersShawarma = question.includes("shawarma");
  const prefersPoundedYam =
    question.includes("pounded") || question.includes("yam");
  const prefersAmala =
    question.includes("amala") || question.includes("gbegiri");

  if (prefersAmala && (budget === null || budget >= 3000)) {
    return "I recommend Amala & Gbegiri at ₦3,000.";
  }
  if (prefersPoundedYam && (budget === null || budget >= 4000)) {
    return "I recommend Pounded Yam at ₦4,000.";
  }
  if (
    prefersChicken &&
    !question.includes("grilled") &&
    (budget === null || budget >= 4000)
  ) {
    return "I recommend Chicken & Chips at ₦4,000.";
  }
  if (prefersShawarma && (budget === null || budget >= 4000)) {
    return "I recommend Shawarma at ₦4,000.";
  }
  if (prefersJollof && budget !== null && budget < 7000) {
    return "The priced jollof options are above that budget. Amala & Gbegiri is available at ₦3,000.";
  }
  if (prefersJollof && (budget === null || budget >= 7000)) {
    return "I recommend Jollof Rice Combo Basic at ₦7,000.";
  }
  if (budget !== null) {
    const affordable = menuItems.filter(
      (item) => item.price !== null && item.price < budget,
    );
    if (affordable.length > 0) {
      const lowest = affordable.reduce((item, current) =>
        current.price < item.price ? current : item,
      );
      return `I recommend ${lowest.name} at ${formatPrice(lowest.price)}.`;
    }
    return unavailable("A priced meal within that budget");
  }

  return "I recommend Amala & Gbegiri at ₦3,000.";
}

/**
 * Return a concise answer for a restaurant question.
 * Unknown topics intentionally return an unavailable message with the phone
 * number, so customers have a way to get help.
 */
export function getChatbotReply(input) {
  const question = normalize(input);

  if (!question) {
    return unavailable();
  }

  if (
    question.includes("best") ||
    question.includes("favorite") ||
    question.includes("favourite")
  ) {
    return "The business hasn't identified an objectively best or best-selling dish. Please call Damien's Smoky Kitchen on 080 3220 1672 for a personal recommendation.";
  }

  if (
    question.includes("recommend") ||
    question.includes("suggest") ||
    question.includes("what can i eat") ||
    question.includes("broke") ||
    question.includes("budget")
  ) {
    return recommendation(question);
  }

  if (question.includes("grilled chicken")) {
    if (
      question.includes("price") ||
      question.includes("cost") ||
      question.includes("how much")
    ) {
      return unavailable("The price of Grilled Chicken");
    }
    return "Grilled Chicken is available, but its price isn't currently available. Please call Damien's Smoky Kitchen on 080 3220 1672 before ordering.";
  }

  const specificPrice = itemPrice(question);
  if (
    specificPrice &&
    (question.includes("price") ||
      question.includes("cost") ||
      question.includes("how much") ||
      question.includes("menu"))
  ) {
    return specificPrice;
  }

  if (
    question.includes("cheapest") ||
    question.includes("least expensive") ||
    question.includes("lowest price")
  ) {
    return "Amala & Gbegiri — ₦3,000.";
  }

  if (
    question.includes("most expensive") ||
    question.includes("highest price") ||
    question.includes("priciest")
  ) {
    return "Jollof Rice Combo Full Dish — ₦15,000.";
  }

  if (
    (question.includes("menu") ||
      question.includes("food") ||
      question.includes("dish") ||
      question.includes("meal") ||
      question.includes("price") ||
      question.includes("cost")) &&
    !question.includes("drink") &&
    !question.includes("beverage")
  ) {
    return menuSummary();
  }

  if (
    question.includes("hour") ||
    question.includes("open") ||
    question.includes("close") ||
    (question.includes("when") && !question.includes("deliver"))
  ) {
    return openingHours;
  }

  if (
    question.includes("where") ||
    question.includes("location") ||
    question.includes("address") ||
    question.includes("find") ||
    question.includes("deliver")
  ) {
    if (
      question.includes("deliver") &&
      (question.includes("where") || question.includes("outside"))
    ) {
      return "Delivery is available within Lagos State only. Delivery outside Lagos State isn't available.";
    }
    if (!question.includes("order") && !question.includes("deliver")) {
      return location;
    }
  }

  if (
    question.includes("delivery") ||
    question.includes("deliver") ||
    question.includes("doordash") ||
    question.includes("uber eats")
  ) {
    if (
      question.includes("outside") ||
      question.includes("ogun")
    ) {
      return "Delivery is available within Lagos State only. Delivery outside Lagos State isn't available.";
    }
    if (
      question.includes("fee") ||
      question.includes("charge") ||
      question.includes("cost") ||
      question.includes("how much") ||
      question.includes("time") ||
      question.includes("when")
    ) {
      return unavailable("Delivery fee and delivery time information");
    }
    return "Yes, within Lagos State.";
  }

  if (
    question.includes("order") ||
    question.includes("buy") ||
    question.includes("purchase") ||
    question.includes("whatsapp") ||
    question.includes("website")
  ) {
    return `We accept orders through the website or WhatsApp. Use the provided restaurant contact number for WhatsApp: ${phone}. The WhatsApp number has not been separately verified.`;
  }

  if (
    question.includes("phone") ||
    question.includes("call") ||
    question.includes("contact number") ||
    question.includes("contact")
  ) {
    return `You can contact Damien's Smoky Kitchen on ${phone}.`;
  }

  if (
    question.includes("drink") ||
    question.includes("beverage") ||
    question.includes("cocktail") ||
    question.includes("wine") ||
    question.includes("beer")
  ) {
    return unavailable("Drink information");
  }

  return unavailable();
}