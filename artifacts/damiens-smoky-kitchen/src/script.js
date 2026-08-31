/**
 * Controlled local chatbot prototype for Damien's Smoky Kitchen.
 *
 * This module deliberately contains no AI API calls. It only answers from
 * the restaurant details provided for this prototype.
 */
const menuItems = [{ name: "Amala & Gbegiri", price: 3000 }];

const openingHours = "Our opening hours are 9 AM–9 PM.";
const location =
  "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State.";
const unavailable =
  "That information isn't available. I can answer questions about the known dish, opening hours, location, delivery, and prices.";

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

function menuSummary() {
  return `The menu price I have available is Amala & Gbegiri at ${formatPrice(3000)}.`;
}

function itemPrice(question) {
  const match = menuItems.find((item) =>
    normalize(item.name)
      .split(" ")
      .every((word) => question.includes(word)),
  );

  return match ? `${match.name} is ${formatPrice(match.price)}.` : null;
}

function budgetFrom(question) {
  const thousandBudget = question.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (thousandBudget) {
    return Number(thousandBudget[1]) * 1000;
  }

  const nairaBudget = question.match(/(?:under|below|within|budget of)\s*([\d]+)/);
  return nairaBudget ? Number(nairaBudget[1]) : null;
}

/**
 * Return a concise answer for a restaurant question.
 * Unknown topics intentionally return an unavailable message.
 */
export function getChatbotReply(input) {
  const question = normalize(input);

  if (!question) {
    return unavailable;
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
    question.includes("recommend") ||
    question.includes("suggest") ||
    question.includes("what can i eat") ||
    question.includes("under 5000") ||
    question.includes("below 5000")
  ) {
    const budget = budgetFrom(question);
    if (budget === null || budget >= menuItems[0].price) {
      return `I recommend Amala & Gbegiri at ${formatPrice(3000)}.`;
    }
    return "The only priced meal I have available is Amala & Gbegiri at ₦3,000, which is above that budget.";
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
    return "The most expensive priced dish I have available is Amala & Gbegiri at ₦3,000.";
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

  if (
    question.includes("hour") ||
    question.includes("open") ||
    question.includes("close") ||
    question.includes("when")
  ) {
    return openingHours;
  }

  if (
    question.includes("where") ||
    question.includes("location") ||
    question.includes("address") ||
    question.includes("find")
  ) {
    return location;
  }

  if (
    question.includes("delivery") ||
    question.includes("deliver") ||
    question.includes("doordash") ||
    question.includes("uber eats")
  ) {
    return "Yes, we deliver within Lagos State.";
  }

  if (
    question.includes("order") ||
    question.includes("takeout") ||
    question.includes("take out")
  ) {
    return "Ordering details aren't available.";
  }

  if (
    question.includes("drink") ||
    question.includes("beverage") ||
    question.includes("cocktail") ||
    question.includes("wine") ||
    question.includes("beer")
  ) {
    return "Drink information isn't available.";
  }

  return unavailable;
}