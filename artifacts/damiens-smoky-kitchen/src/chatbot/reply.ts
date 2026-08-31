import { restaurantKnowledge } from "./knowledge.ts";

type PricedMenuItem = {
  name: string;
  price: number;
  aliases: string[];
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+(?=\d)/g, "$1")
    .trim();
}

function formatPrice(price: number): string {
  return `₦${price.toLocaleString("en-NG")}`;
}

function phoneFallback(topic = "That information"): string {
  return `${topic} isn't currently available. Please call ${restaurantKnowledge.businessName} on ${restaurantKnowledge.phone} for assistance.`;
}

function menuSummary(): string {
  const items = restaurantKnowledge.menu.map((item) =>
    item.price === null
      ? `${item.name} — price isn't currently available`
      : `${item.name} — ${formatPrice(item.price)}`,
  );
  return `The available menu information is: ${items.join("; ")}.`;
}

function drinksSummary(): string {
  const drinks = restaurantKnowledge.proposedDrinks.map((drink) => drink.name);
  return `Our current proposed drinks list includes ${drinks.join(", ")}. Prices aren't currently available. Please call ${restaurantKnowledge.businessName} on ${restaurantKnowledge.phone} for drink pricing.`;
}

function itemPrice(question: string): string | null {
  const item = restaurantKnowledge.menu.find((menuItem) =>
    menuItem.aliases.some((alias) => question.includes(normalize(alias))),
  );

  if (!item) return null;
  if (item.price === null) return phoneFallback(`The price of ${item.name}`);
  return `${item.name} is ${formatPrice(item.price)}.`;
}

function budgetFrom(question: string): number | null {
  const thousandBudget = question.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (thousandBudget) return Number(thousandBudget[1]) * 1000;

  const amount = question.match(
    /(?:₦|naira\s*)\s*([\d,]+)|(?:under|below|within|budget of|have)\s*(?:₦|naira\s*)?([\d,]+)/,
  );
  const rawAmount = amount?.[1] ?? amount?.[2];
  return rawAmount ? Number(rawAmount.replace(/,/g, "")) : null;
}

function recommendation(question: string): string {
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
    const affordable = restaurantKnowledge.menu.filter(
      (item): item is PricedMenuItem =>
        item.price !== null && item.price <= budget,
    );
    if (affordable.length > 0) {
      const lowest = affordable.reduce((current, item) =>
        item.price < current.price ? item : current,
      );
      return `I recommend ${lowest.name} at ${formatPrice(lowest.price)}.`;
    }
    return phoneFallback("A priced meal within that budget");
  }

  return "I recommend Amala & Gbegiri at ₦3,000.";
}

export function getChatbotReply(input: string): string {
  const question = normalize(input);

  if (!question) return phoneFallback();

  if (
    question === "hi" ||
    question === "hello" ||
    question === "hey" ||
    question.includes("good morning") ||
    question.includes("good afternoon") ||
    question.includes("good evening")
  ) {
    return "Hello from Damien's Smoky Kitchen. I can help with our menu, prices, hours, ordering, delivery, location, phone number, and proposed drinks list.";
  }

  if (
    question.includes("best") ||
    question.includes("favorite") ||
    question.includes("favourite") ||
    question.includes("most popular")
  ) {
    return `The business hasn't identified an objectively best or best-selling dish. Please call ${restaurantKnowledge.businessName} on ${restaurantKnowledge.phone} for a personal recommendation.`;
  }

  if (
    question.includes("recommend") ||
    question.includes("suggest") ||
    question.includes("what can i eat") ||
    question.includes("what should i eat") ||
    question.includes("broke") ||
    question.includes("budget") ||
    question.includes("afford") ||
    question.includes("spend") ||
    question.includes("have ₦") ||
    question.includes("have naira")
  ) {
    if (
      question.includes("drink") ||
      question.includes("beverage") ||
      question.includes("zobo") ||
      question.includes("chapman") ||
      question.includes("malt")
    ) {
      return drinksSummary();
    }
    return recommendation(question);
  }

  if (
    question.includes("drink") ||
    question.includes("beverage") ||
    question.includes("zobo") ||
    question.includes("chapman") ||
    question.includes("malt") ||
    question.includes("water")
  ) {
    return drinksSummary();
  }

  if (
    question.includes("vegan") ||
    question.includes("vegetarian") ||
    question.includes("halal") ||
    question.includes("ingredient") ||
    question.includes("allerg") ||
    question.includes("nutrition") ||
    question.includes("calorie") ||
    question.includes("gluten") ||
    question.includes("payment") ||
    question.includes("catering")
  ) {
    return phoneFallback("That dietary or service information");
  }

  if (question.includes("delivery") || question.includes("deliver")) {
    if (
      question.includes("outside") ||
      question.includes("ogun") ||
      question.includes("outside lagos")
    ) {
      return `${restaurantKnowledge.delivery} ${restaurantKnowledge.deliveryOutsideLagos}`;
    }
    if (
      question.includes("fee") ||
      question.includes("charge") ||
      question.includes("cost") ||
      question.includes("how much") ||
      question.includes("time") ||
      question.includes("when")
    ) {
      return phoneFallback("Delivery fee and delivery time information");
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
    return `${restaurantKnowledge.ordering} Use ${restaurantKnowledge.phone} for WhatsApp orders.`;
  }

  if (
    question.includes("phone") ||
    question.includes("call") ||
    question.includes("contact") ||
    question.includes("number")
  ) {
    return `You can contact ${restaurantKnowledge.businessName} on ${restaurantKnowledge.phone}.`;
  }

  if (
    question.includes("where") ||
    question.includes("location") ||
    question.includes("address") ||
    question.includes("located") ||
    question.includes("find")
  ) {
    return restaurantKnowledge.location + ".";
  }

  if (
    question.includes("hour") ||
    question.includes("open") ||
    question.includes("close") ||
    question.includes("opening time") ||
    (question.includes("when") && !question.includes("deliver"))
  ) {
    return `Our opening hours are ${restaurantKnowledge.openingHours}.`;
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
    question.includes("menu") ||
    question.includes("food") ||
    question.includes("dish") ||
    question.includes("meal") ||
    question.includes("price") ||
    question.includes("cost")
  ) {
    return menuSummary();
  }

  return phoneFallback();
}