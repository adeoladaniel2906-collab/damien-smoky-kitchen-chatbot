import { restaurantKnowledge, type MenuItem } from "./knowledge.ts";

type PricedMenuItem = {
  name: string;
  price: number;
  aliases: string[];
  category: string;
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
  const formatSection = (title: string, items: MenuItem[]) => {
    const grouped = new Map<string, string[]>();
    for (const item of items) {
      const entries = grouped.get(item.category) ?? [];
      entries.push(
        item.price === null
          ? `${item.name} — price isn't currently available`
          : `${item.name} — ${formatPrice(item.price)}`,
      );
      grouped.set(item.category, entries);
    }

    return `${title}: ${Array.from(grouped, ([category, entries]) => `${category}: ${entries.join(", ")}`).join("; ")}`;
  };

  return `All prices are in Nigerian Naira. ${formatSection("Regular menu", restaurantKnowledge.menu)} ${formatSection("Vegan menu", restaurantKnowledge.veganMenu)}.`;
}

function pricedMenuItems(): PricedMenuItem[] {
  return restaurantKnowledge.menu.filter(
    (item): item is PricedMenuItem =>
      item.price !== null &&
      !["Drinks", "Alcoholic Drinks", "Vegan Drinks"].includes(item.category),
  );
}

function menuItemMatchesQuestion(
  item: { name: string; aliases: string[] },
  question: string,
): boolean {
  const q = normalize(question);
  const variants = [item.name, ...item.aliases].map(normalize);

  return variants.some((variant) => {
    if (!variant) return false;
    if (variant === q || q.includes(variant) || variant.includes(q)) return true;

    const includesBaseName =
      q.includes("pounded yam") && variant.includes("pounded yam") ||
      q.includes("fried rice") && variant.includes("fried rice") ||
      q.includes("jollof rice") && variant.includes("jollof") ||
      q.includes("amala") && variant.includes("amala") ||
      q.includes("fufu") && variant.includes("fufu") ||
      q.includes("eba") && variant.includes("eba");

    return includesBaseName;
  });
}

function drinksSummary(): string {
  const drinks = restaurantKnowledge.menu.filter(
    (item) => item.category === "Drinks" || item.category === "Alcoholic Drinks",
  );
  const veganDrinks = restaurantKnowledge.veganMenu.filter(
    (item) => item.category === "Vegan Drinks",
  );
  const formatItems = (items: MenuItem[]) =>
    items
      .map((item) => `${item.name} — ${item.price === null ? "price isn't currently available" : formatPrice(item.price)}`)
      .join(", ");

  return `Regular drinks: ${formatItems(drinks)}. Vegan drinks: ${formatItems(veganDrinks)}.`;
}

function veganMenuSummary(): string {
  const grouped = new Map<string, string[]>();
  for (const item of restaurantKnowledge.veganMenu) {
    const entries = grouped.get(item.category) ?? [];
    entries.push(`${item.name} — ${item.price === null ? "price isn't currently available" : formatPrice(item.price)}`);
    grouped.set(item.category, entries);
  }

  return `Vegan options (prices in Nigerian Naira): ${Array.from(grouped, ([category, entries]) => `${category}: ${entries.join(", ")}`).join("; ")}.`;
}

function itemPrice(question: string): string | null {
  const asksForUnspecifiedJollof =
    question.includes("jollof") &&
    !question.includes("spaghetti") &&
    !question.includes("small") &&
    !question.includes("large");
  if (asksForUnspecifiedJollof) {
    return "Jollof Rice (small) is ₦800 and Jollof Rice (large) is ₦1,500.";
  }

  const matches = restaurantKnowledge.menu.filter((menuItem) =>
    menuItemMatchesQuestion(menuItem, question),
  );

  if (matches.length === 0) return null;

  const sizeKeyword = question.includes("large") ? "large" : question.includes("small") ? "small" : null;
  const sizedMatch = sizeKeyword
    ? matches.find((menuItem) =>
        menuItem.aliases.some((alias) => normalize(alias).includes(sizeKeyword)),
      )
    : null;

  const item = sizedMatch ?? matches[0];

  if (!item || item.price === null) return phoneFallback(`The price of ${item?.name ?? "that item"}`);
  return `${item.name} is ${formatPrice(item.price)}.`;
}

function mentionsMenuItem(question: string): boolean {
  return restaurantKnowledge.menu.some((item) =>
    menuItemMatchesQuestion(item, question),
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
    /(?:₦|naira\s*)\s*([\d,]+)|(?:under|below|within|budget of|have|for)\s*(?:₦|naira\s*)?([\d,]+)/,
  );
  const rawAmount = amount?.[1] ?? amount?.[2];
  return rawAmount ? Number(rawAmount.replace(/,/g, "")) : null;
}

function recommendation(question: string): string {
  const budget = budgetFrom(question);
  const prefersChicken = question.includes("chicken");
  const prefersJollof = question.includes("jollof");
  const prefersPoundedYam =
    question.includes("pounded") || question.includes("yam");
  const prefersAmala =
    question.includes("amala") || question.includes("gbegiri");

  if (
    question.includes("shawarma") ||
    question.includes("chicken and chips") ||
    question.includes("chicken chips")
  ) {
    return phoneFallback("That menu item");
  }

  const recommendedItem = (aliases: string[]) =>
    restaurantKnowledge.menu.find((item) =>
      aliases.some((alias) => item.aliases.includes(alias)),
    );

  const amala = recommendedItem(["amala ewedu gbegiri"]);
  if (prefersAmala && amala?.price !== null && amala?.price !== undefined) {
    if (budget === null || budget >= amala.price) {
      return `I recommend ${amala.name} at ${formatPrice(amala.price)}.`;
    }
    return `${amala.name} costs ${formatPrice(amala.price)}, which is above that budget.`;
  }

  const poundedYam = recommendedItem(["pounded yam egusi"]);
  if (
    prefersPoundedYam &&
    poundedYam?.price !== null &&
    poundedYam?.price !== undefined
  ) {
    if (budget === null || budget >= poundedYam.price) {
      return `I recommend ${poundedYam.name} at ${formatPrice(poundedYam.price)}.`;
    }
    return `${poundedYam.name} costs ${formatPrice(poundedYam.price)}, which is above that budget.`;
  }

  const chicken = question.includes("fried chicken")
    ? recommendedItem(["fried chicken"])
    : recommendedItem(["grilled chicken"]);
  if (
    prefersChicken &&
    chicken?.price !== null &&
    chicken?.price !== undefined
  ) {
    if (budget === null || budget >= chicken.price) {
      return `I recommend ${chicken.name} at ${formatPrice(chicken.price)}.`;
    }
    return `${chicken.name} costs ${formatPrice(chicken.price)}, which is above that budget.`;
  }

  const jollof = recommendedItem(["jollof rice small"]);
  if (
    prefersJollof &&
    jollof?.price !== null &&
    jollof?.price !== undefined
  ) {
    if (budget === null || budget >= jollof.price) {
      return `I recommend ${jollof.name} at ${formatPrice(jollof.price)}.`;
    }
    return `${jollof.name} costs ${formatPrice(jollof.price)}, which is above that budget.`;
  }

  if (budget !== null) {
    const affordable = restaurantKnowledge.menu.filter(
      (item): item is PricedMenuItem =>
        item.price !== null &&
        item.price <= budget &&
        item.category !== "Sides" &&
        item.category !== "Proteins" &&
        item.category !== "Small Chops" &&
        item.category !== "Drinks" &&
        item.category !== "Alcoholic Drinks",
    );
    if (affordable.length > 0) {
      const lowest = affordable.reduce((current, item) =>
        item.price < current.price ? item : current,
      );
      return `I recommend ${lowest.name} at ${formatPrice(lowest.price)}.`;
    }
    return phoneFallback("A priced meal within that budget");
  }

  return "I recommend Jollof Rice (small) at ₦800.";
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
    return veganMenuSummary();
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

  if ((question.includes("do you have") || question.includes("have you got") || question.includes("is there")) && mentionsMenuItem(question)) {
    const matches = restaurantKnowledge.menu.filter((item) =>
      menuItemMatchesQuestion(item, question),
    );
    const uniqueMatches = matches.filter(
      (item, index, arr) => arr.findIndex((candidate) => candidate.name === item.name) === index,
    );

    const response = uniqueMatches
      .map((item) => `${item.name} — ${formatPrice(item.price ?? 0)}`)
      .join("; ");

    return `Yes. We have ${response}.`;
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
    const menuNames = restaurantKnowledge.menu.map((item) => item.name).join(", ");
    return `Our regular menu includes ${menuNames}.`;
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
    question.includes("shawarma") ||
    question.includes("chicken and chips") ||
    question.includes("chicken chips")
  ) {
    return phoneFallback("That menu item");
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
    const priced = pricedMenuItems();
    const lowestPrice = Math.min(...priced.map((item) => item.price));
    const lowest = priced.filter((item) => item.price === lowestPrice);
    return `The cheapest listed menu items are ${lowest
      .map((item) => `${item.name} — ${formatPrice(item.price)}`)
      .join(" and ")}.`;
  }

  if (
    question.includes("most expensive") ||
    question.includes("highest price") ||
    question.includes("priciest")
  ) {
    const priced = pricedMenuItems();
    const highestPrice = Math.max(...priced.map((item) => item.price));
    const highest = priced.filter((item) => item.price === highestPrice);
    return `The most expensive listed menu item is ${highest
      .map((item) => `${item.name} — ${formatPrice(item.price)}`)
      .join(" and ")}.`;
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

function needsAiReasoning(question: string): boolean {
  return (
    question.includes("recommend") ||
    question.includes("suggest") ||
    question.includes("what can i eat") ||
    question.includes("what should i eat") ||
    question.includes("what can i get") ||
    question.includes("budget") ||
    question.includes("afford") ||
    question.includes("spend") ||
    question.includes("for two") ||
    question.includes("for three") ||
    budgetFrom(question) !== null
  );
}

export function getManualReply(input: string): string | null {
  const question = normalize(input);
  if (!question || needsAiReasoning(question)) return null;

  const reply = getChatbotReply(input);
  return reply === phoneFallback() ? null : reply;
}