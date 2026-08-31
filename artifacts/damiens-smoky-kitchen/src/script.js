/**
 * Local chatbot knowledge for Damien's Smoky Kitchen.
 *
 * This module deliberately contains no API calls. Every answer is derived
 * from the restaurant information shown on the site.
 */
const menuItems = [
  { name: "Smoky jollof", price: 18 },
  { name: "Suya skewers", price: 16 },
  { name: "Pepper prawns", price: 24 },
  { name: "Charcoal chicken", price: 22 },
  { name: "Egusi & pounded yam", price: 21 },
  { name: "Efo riro", price: 19 },
  { name: "Black-eyed bean bowl", price: 17 },
  { name: "Oxtail pepper soup", price: 23 },
  { name: "Dundun plantain", price: 9 },
  { name: "Puff puff", price: 8 },
  { name: "Chin chin", price: 6 },
  { name: "Pepper soup broth", price: 7 },
];

const openingHours =
  "We are open Tuesday–Thursday 5–10pm, Friday–Saturday 5–11pm, and Sunday 11am–4pm for lunch. We are closed Monday for prep and family.";

const address =
  "Find us at 1842 San Pablo Avenue, West Oakland, CA 94612, right by the corner bookstore. Street parking is usually easiest on 19th.";

const unavailable =
  "That information isn't available yet. I can share the menu, prices, opening hours, or location.";

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPrice(price) {
  return `$${price}`;
}

function menuSummary() {
  return `Our menu includes ${menuItems
    .map((item) => `${item.name} (${formatPrice(item.price)})`)
    .join(", ")}.`;
}

function itemPrice(question) {
  const match = menuItems.find((item) => {
    const itemWords = normalize(item.name).split(" ");
    return itemWords.every((word) => question.includes(word));
  });

  if (!match) {
    return null;
  }

  return `${match.name} is ${formatPrice(match.price)}.`;
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
    question.includes("cheapest") ||
    question.includes("least expensive") ||
    question.includes("lowest price")
  ) {
    const cheapest = menuItems.reduce((item, current) =>
      current.price < item.price ? current : item,
    );
    return `The cheapest item is ${cheapest.name} at ${formatPrice(cheapest.price)}.`;
  }

  if (
    question.includes("most expensive") ||
    question.includes("highest price") ||
    question.includes("priciest")
  ) {
    const mostExpensive = menuItems.reduce((item, current) =>
      current.price > item.price ? current : item,
    );
    return `The most expensive item is ${mostExpensive.name} at ${formatPrice(mostExpensive.price)}.`;
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
    question.includes("find") ||
    question.includes("parking")
  ) {
    return address;
  }

  if (
    question.includes("delivery") ||
    question.includes("deliver") ||
    question.includes("doordash") ||
    question.includes("uber eats")
  ) {
    return "Delivery information isn't available yet. The restaurant says takeout travels well; ask about tonight's family packs.";
  }

  if (
    question.includes("order") ||
    question.includes("takeout") ||
    question.includes("take out") ||
    question.includes("family pack")
  ) {
    return "Ordering details aren't available yet. The restaurant says takeout travels well and suggests asking about tonight's family packs.";
  }

  if (
    question.includes("drink") ||
    question.includes("beverage") ||
    question.includes("cocktail") ||
    question.includes("wine") ||
    question.includes("beer")
  ) {
    return "Drink information isn't available yet.";
  }

  return unavailable;
}