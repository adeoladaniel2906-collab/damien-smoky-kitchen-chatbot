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
  return `${topic} isn't currently available. Please contact ${restaurantKnowledge.businessName} on WhatsApp at ${restaurantKnowledge.phone} for assistance.`;
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
  return `${restaurantKnowledge.drinksAndDesserts} Current drink options and prices aren't currently available. Please contact ${restaurantKnowledge.businessName} on WhatsApp at ${restaurantKnowledge.phone} for drink pricing.`;
}

function itemPrice(question: string): string | null {
  const asksForUnspecifiedJollof =
    question.includes("jollof") &&
    !question.includes("basic") &&
    !question.includes("full");
  if (asksForUnspecifiedJollof) {
    return "Our priced jollof options are Jollof Rice Combo Basic at ₦7,000 and Jollof Rice Combo Full Dish at ₦15,000.";
  }

  const item = restaurantKnowledge.menu.find((menuItem) =>
    menuItem.aliases.some((alias) => question.includes(normalize(alias))),
  );

  if (!item) return null;
  if (item.price === null) return phoneFallback(`The price of ${item.name}`);
  return `${item.name} is ${formatPrice(item.price)}.`;
}

function mentionsMenuItem(question: string): boolean {
  if (question.includes("jollof")) return true;
  return restaurantKnowledge.menu.some((item) =>
    item.aliases.some((alias) => question.includes(normalize(alias))),
  );
}

function budgetFrom(question: string): number | null {
  const thousandBudget = question.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (thousandBudget) return Number(thousandBudget[1]) * 1000;

  const wordThousands: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
  };
  const wordBudget = question.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\s+thousand\b/,
  );
  if (wordBudget) return wordThousands[wordBudget[1]] * 1000;

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
    return `Our recommended dishes include ${restaurantKnowledge.recommendedDishes}`;
  }

  if (
    question.includes("vegan")
  ) {
    return restaurantKnowledge.veganOptions;
  }

  if (question.includes("vegetarian")) {
    return restaurantKnowledge.vegetarianOptions;
  }

  if (question.includes("gluten")) {
    return restaurantKnowledge.glutenFreeOptions;
  }

  if (question.includes("halal")) {
    return restaurantKnowledge.halalAdvice;
  }

  if (question.includes("allerg")) {
    return restaurantKnowledge.allergyAdvice;
  }

  if (question.includes("ingredient")) {
    return phoneFallback("Ingredient information");
  }

  if (
    question.includes("nutrition") ||
    question.includes("nutritional") ||
    question.includes("calorie") ||
    question.includes("medical")
  ) {
    return phoneFallback("Nutritional information");
  }

  if (
    question.includes("dietary restriction") ||
    question.includes("custom meal") ||
    question.includes("special diet")
  ) {
    return restaurantKnowledge.customDietary;
  }

  if (
    !question.includes("reservation") &&
    !question.includes("booking") &&
    (
      question.includes("recommend") ||
      question.includes("suggest") ||
      question.includes("what can i eat") ||
      question.includes("what should i eat") ||
      question.includes("what can i get") ||
      question.includes("broke") ||
      question.includes("budget") ||
      question.includes("afford") ||
      question.includes("spend") ||
      question.includes("have ₦") ||
      question.includes("have naira") ||
      budgetFrom(question) !== null
    )
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
    if (question.includes("dessert")) {
      return `${restaurantKnowledge.drinksAndDesserts} Dessert information isn't currently available. Current drink options and prices aren't currently available. Please contact ${restaurantKnowledge.businessName} on WhatsApp at ${restaurantKnowledge.phone}.`;
    }
    return drinksSummary();
  }

  if (question.includes("kid") || question.includes("child")) {
    return restaurantKnowledge.kidsMenu;
  }

  if (
    question.includes("full menu online") ||
    question.includes("menu online") ||
    question.includes("see the menu online")
  ) {
    return `${restaurantKnowledge.menuOnline} Website: ${restaurantKnowledge.website}.`;
  }

  if (question.includes("seasonal") || question.includes("change your menu")) {
    return restaurantKnowledge.menuUpdates;
  }

  if (
    question.includes("type of food") ||
    question.includes("kind of food") ||
    question.includes("what food do you serve")
  ) {
    return `${restaurantKnowledge.foodDescription} Our menu includes Jollof Rice Combo, Amala & Gbegiri, Okra, Ewedu, Pounded Yam, Grilled Chicken, Chicken & Chips, and Shawarma.`;
  }

  if (question.includes("dessert")) {
    return phoneFallback("Dessert information");
  }

  if (
    (
      question.includes("delivery") ||
      question.includes("deliver") ||
      question.includes("bring food") ||
      question.includes("bring my food")
    ) &&
    !question.includes("wrong order") &&
    !question.includes("received the wrong") &&
    !question.includes("food was cold") &&
    !question.includes("cold food")
  ) {
    if (
      question.includes("outside") ||
      question.includes("ogun") ||
      question.includes("outside lagos")
    ) {
      return `${restaurantKnowledge.delivery} ${restaurantKnowledge.deliveryOutsideLagos}`;
    }

    if (
      question.includes("track") ||
      question.includes("tracking")
    ) {
      return restaurantKnowledge.deliveryTracking;
    }

    if (
      question.includes("minimum order") ||
      question.includes("min order") ||
      question.includes("least order")
    ) {
      return `The minimum delivery order is ₦${restaurantKnowledge.minimumDeliveryOrder.toLocaleString("en-NG")}.`;
    }

    if (
      question.includes("fee") ||
      question.includes("charge") ||
      question.includes("delivery cost")
    ) {
      return restaurantKnowledge.deliveryFee;
    }

    if (
      question.includes("time") ||
      question.includes("when") ||
      question.includes("how long") ||
      question.includes("how soon")
    ) {
      return restaurantKnowledge.deliveryTime;
    }

    return "Yes, within Lagos State.";
  }

  if (
    question.includes("takeaway") ||
    question.includes("take away")
  ) {
    return restaurantKnowledge.takeaway;
  }

  if (
    question.includes("reservation") ||
    question.includes("booking") ||
    question.includes("book") ||
    question.includes("book a table") ||
    question.includes("reserve")
  ) {
    if (
      question.includes("how far") ||
      question.includes("advance") ||
      question.includes("early")
    ) {
      return restaurantKnowledge.reservations;
    }
    if (
      question.includes("large group") ||
      question.includes("group") ||
      question.includes("party")
    ) {
      return restaurantKnowledge.largeGroupBookings;
    }
    if (
      question.includes("minimum spend") ||
      question.includes("minimum")
    ) {
      return restaurantKnowledge.reservationMinimumSpend;
    }
    if (
      question.includes("cancel") ||
      question.includes("reschedule")
    ) {
      return restaurantKnowledge.reservationChanges;
    }
    return restaurantKnowledge.reservations;
  }

  if (
    question.includes("birthday package") ||
    question.includes("birthday arrangement")
  ) {
    return restaurantKnowledge.birthdayPackage;
  }

  if (
    question.includes("private event") ||
    question.includes("special occasion") ||
    question.includes("birthday party")
  ) {
    return restaurantKnowledge.privateEvents;
  }

  if (
    question.includes("cater") ||
    question.includes("outside event")
  ) {
    return restaurantKnowledge.outsideCatering;
  }

  if (question.includes("event planner")) {
    return restaurantKnowledge.eventPlanner;
  }

  if (
    question.includes("payment method") ||
    question.includes("how can i pay") ||
    question.includes("accept cash") ||
    question.includes("bank transfer") ||
    question.includes("pos")
  ) {
    return restaurantKnowledge.paymentMethods;
  }

  if (
    question.includes("pay online") ||
    question.includes("online payment")
  ) {
    return restaurantKnowledge.onlinePayment;
  }

  if (
    question.includes("split bill") ||
    question.includes("split payment")
  ) {
    return restaurantKnowledge.splitBills;
  }

  if (
    question.includes("service fee") ||
    question.includes("service charge")
  ) {
    return restaurantKnowledge.serviceFee;
  }

  if (
    question.includes("website") &&
    (question.includes("what") ||
      question.includes("where") ||
      question.includes("url") ||
      question.includes("site"))
  ) {
    return `The website is ${restaurantKnowledge.website}.`;
  }

  if (
    question.includes("wrong order") ||
    question.includes("received the wrong")
  ) {
    return `Please contact Damien's Smoky Kitchen on WhatsApp at ${restaurantKnowledge.phone} as soon as possible with your order details. Our staff will review the issue and assist you.`;
  }

  if (
    question.includes("food was cold") ||
    question.includes("cold food")
  ) {
    return `Please contact Damien's Smoky Kitchen on WhatsApp at ${restaurantKnowledge.phone} with your order details. We will review the complaint and determine the appropriate solution.`;
  }

  if (
    question.includes("modify my order") ||
    question.includes("change my order") ||
    question.includes("change an order")
  ) {
    return `Contact Damien's Smoky Kitchen on WhatsApp at ${restaurantKnowledge.phone} immediately. Changes may not be possible once the kitchen has started preparing the order.`;
  }

  if (question.includes("refund")) {
    return `Refunds depend on the circumstances of the order. Contact Damien's Smoky Kitchen on WhatsApp at ${restaurantKnowledge.phone} with your order details so the issue can be reviewed.`;
  }

  if (
    question.includes("drive through") ||
    question.includes("drive-through")
  ) {
    return restaurantKnowledge.driveThrough;
  }

  if (question.includes("parking")) {
    return restaurantKnowledge.parking;
  }

  if (
    question.includes("public holiday") ||
    question.includes("public holidays")
  ) {
    return restaurantKnowledge.publicHolidayHours;
  }

  if (
    question.includes("family-friendly") ||
    question.includes("family friendly") ||
    question.includes("families") ||
    question.includes("couples")
  ) {
    return restaurantKnowledge.familyFriendly;
  }

  if (
    question.includes("outside seating") ||
    question.includes("seating outside") ||
    question.includes("outdoor seating")
  ) {
    return restaurantKnowledge.outdoorSeating;
  }

  if (question.includes("wi-fi") || question.includes("wifi")) {
    return restaurantKnowledge.wifi;
  }

  if (
    question.includes("background music") ||
    question.includes("live entertainment") ||
    question.includes("entertainment")
  ) {
    return restaurantKnowledge.entertainment;
  }

  if (
    question.includes("air-conditioned") ||
    question.includes("air conditioned") ||
    question.includes("air conditioning")
  ) {
    return restaurantKnowledge.airConditioning;
  }

  if (
    question.includes("loyalty") ||
    question.includes("rewards program") ||
    question.includes("reward program")
  ) {
    return restaurantKnowledge.loyaltyProgram;
  }

  if (
    !question.includes("stay updated") &&
    !question.includes("latest") &&
    (
      question.includes("discount") ||
      question.includes("promotion") ||
      question.includes("promotions") ||
      question.includes("offers")
    )
  ) {
    if (
      question.includes("student") ||
      question.includes("corporate")
    ) {
      return restaurantKnowledge.discounts;
    }
    return restaurantKnowledge.promotions;
  }

  if (
    question.includes("stay updated") ||
    question.includes("latest news") ||
    question.includes("latest offers") ||
    question.includes("latest updates")
  ) {
    return restaurantKnowledge.updates;
  }

  if (
    question.includes("order") ||
    question.includes("buy") ||
    question.includes("purchase") ||
    question.includes("whatsapp") ||
    question.includes("website") ||
    (question.includes("want") && mentionsMenuItem(question))
  ) {
    return `${restaurantKnowledge.ordering} Visit ${restaurantKnowledge.website} or use WhatsApp at ${restaurantKnowledge.phone}.`;
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

  if (
    question.includes("how much does a meal") ||
    question.includes("meal cost") ||
    question.includes("cost of a meal")
  ) {
    return restaurantKnowledge.mealPricing;
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
    question.includes("what do you have") ||
    question.includes("what have you got") ||
    question.includes("available") ||
    question.includes("price") ||
    question.includes("cost")
  ) {
    return menuSummary();
  }

  return phoneFallback();
}