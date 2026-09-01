export type MenuItem = {
  name: string;
  price: number | null;
  aliases: string[];
  category: string;
};

export type KnowledgeCatalogItem = MenuItem & {
  description?: string;
};

export type CustomerFaq = {
  id: string;
  question: string;
  answer: string;
  aliases: string[];
};

export type ChatbotBehaviorRules = {
  responseStyle: "natural, polite, brief";
  useExternalAi: false;
  officialSourceOnly: true;
  replaceMenuPricesWhenOfficialDataArrives: true;
  neverInvent: string[];
  unavailableInformationResponse: string;
  recommendationPolicy: string;
  dietarySafetyPolicy: string;
  orderingPolicy: string;
};

export const restaurantKnowledge = {
  businessName: "Damien's Smoky Kitchen",
  openingHours: "9:00 AM–9:00 PM daily",
  publicHolidayHours:
    "Yes, we are open on public holidays during our normal operating hours.",
  phone: "080 32 20 16 72",
  website: "DamienStore.food.com",
  location:
    "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State, Nigeria",
  driveThrough: "Yes.",
  parking: "Yes, parking is available for customers.",
  ordering: "Orders are accepted through the website or WhatsApp.",
  foodDescription:
    "We serve Nigerian dishes and popular fast-food options.",
  recommendedDishes:
    "Jollof Rice, Amala + Ewedu + Gbegiri, and Pounded Yam with a protein.",
  vegetarianOptions:
    "Yes. Ask about available vegetarian-friendly dishes when ordering.",
  veganOptions: "No dedicated vegan menu is currently available.",
  kidsMenu: "No dedicated kids' menu is currently available.",
  glutenFreeOptions:
    "Yes. Tell us about dietary restrictions when ordering so staff can recommend suitable options.",
  menuUpdates:
    "The menu may be updated periodically based on availability and customer demand.",
  menuOnline:
    "Customers can view the menu and place orders through the website.",
  mealPricing:
    "Menu prices vary by item and portion. Ask about a specific menu item for its current price.",
  drinksAndDesserts:
    "Drinks are available. Ask for current drink options and prices.",
  reservations:
    "Reservations are available through WhatsApp. Contact us as early as possible to book.",
  largeGroupBookings:
    "Large group bookings are available depending on availability and group size. Contact us directly to confirm.",
  reservationMinimumSpend:
    "There may be a minimum spend depending on the booking. Confirm the amount when making the reservation.",
  reservationChanges:
    "Contact us as soon as possible to cancel or reschedule a reservation.",
  takeaway: "Takeaway orders are available.",
  delivery: "Delivery is available within Lagos State only.",
  deliveryOutsideLagos: "Delivery outside Lagos State isn't available.",
  deliveryTime:
    "Delivery generally takes around 30 minutes, depending on location, traffic, and order volume.",
  deliveryFee:
    "Delivery fees depend on location and delivery distance. Confirm the current fee when ordering.",
  minimumDeliveryOrder: 3000,
  deliveryTracking:
    "Orders can be tracked through the website when tracking is available.",
  privateEvents:
    "Private events and special occasions can be discussed with the restaurant.",
  birthdayPackage:
    "Birthday arrangements are available depending on the customer's requirements.",
  outsideCatering:
    "Outside-event catering can be discussed with the restaurant.",
  eventPlanner:
    "No dedicated event planner is currently available, but staff can assist with event arrangements.",
  paymentMethods:
    "Cash, bank transfer, and POS are accepted, subject to availability.",
  onlinePayment:
    "Online payment can be made through the website when available.",
  splitBills:
    "Split payments can be accommodated where practical. Inform staff before payment.",
  serviceFee:
    "Any applicable service charges will be communicated before payment.",
  allergyAdvice:
    "Tell staff about allergies before ordering so they can advise about suitable options.",
  halalAdvice:
    "Confirm the current halal status of specific meat items before ordering.",
  customDietary:
    "Custom meals may be possible. Explain dietary requirements when placing the order.",
  familyFriendly: "Damien's Smoky Kitchen welcomes families and couples.",
  outdoorSeating:
    "Outdoor seating may be available depending on capacity and weather.",
  wifi: "Wi-Fi is available for customers.",
  entertainment:
    "Background music may be provided. Live entertainment is not currently a standard service.",
  airConditioning: "The indoor dining area is air-conditioned.",
  loyaltyProgram: "No dedicated loyalty program is currently available.",
  promotions:
    "Promotions may be offered from time to time. Check the website or contact us for current offers.",
  discounts:
    "Student and corporate discounts are not guaranteed. Contact us about current offers.",
  updates:
    "Check the website or WhatsApp for the latest news and offers.",
  menu: [
    { name: "Jollof Rice (small)", price: 800, aliases: ["jollof rice small", "small jollof"], category: "Rice Dishes" },
    { name: "Jollof Rice (large)", price: 1500, aliases: ["jollof rice large", "large jollof"], category: "Rice Dishes" },
    { name: "Fried Rice (small)", price: 900, aliases: ["fried rice small", "small fried rice"], category: "Rice Dishes" },
    { name: "Fried Rice (large)", price: 1600, aliases: ["fried rice large", "large fried rice"], category: "Rice Dishes" },
    { name: "White Rice + Stew", price: 800, aliases: ["white rice stew", "white rice and stew"], category: "Rice Dishes" },
    { name: "Coconut Rice", price: 1200, aliases: ["coconut rice"], category: "Rice Dishes" },
    { name: "Ofada Rice + Ayamase Sauce", price: 1500, aliases: ["ofada rice", "ayamase sauce"], category: "Rice Dishes" },
    { name: "Eba + Egusi Soup", price: 1000, aliases: ["eba egusi", "eba and egusi"], category: "Swallow & Soups" },
    { name: "Eba + Okra Soup", price: 1000, aliases: ["eba okra", "eba and okra"], category: "Swallow & Soups" },
    { name: "Eba + Bitterleaf Soup", price: 1000, aliases: ["eba bitterleaf", "eba and bitterleaf"], category: "Swallow & Soups" },
    { name: "Pounded Yam + Egusi", price: 1500, aliases: ["pounded yam egusi", "pounded yam and egusi"], category: "Swallow & Soups" },
    { name: "Pounded Yam + Oha Soup", price: 1600, aliases: ["pounded yam oha", "pounded yam and oha"], category: "Swallow & Soups" },
    { name: "Amala + Ewedu + Gbegiri", price: 1200, aliases: ["amala ewedu gbegiri", "amala and ewedu and gbegiri", "amala"], category: "Swallow & Soups" },
    { name: "Tuwo Shinkafa + Miyan Kuka", price: 1000, aliases: ["tuwo shinkafa", "miyan kuka"], category: "Swallow & Soups" },
    { name: "Fufu + Ogbono Soup", price: 1000, aliases: ["fufu ogbono", "fufu and ogbono"], category: "Swallow & Soups" },
    { name: "Grilled Chicken (1 piece)", price: 1200, aliases: ["grilled chicken", "grilled chicken one piece"], category: "Proteins" },
    { name: "Fried Chicken (1 piece)", price: 1000, aliases: ["fried chicken", "fried chicken one piece"], category: "Proteins" },
    { name: "Beef (per portion)", price: 800, aliases: ["beef", "beef portion"], category: "Proteins" },
    { name: "Goat Meat (per portion)", price: 1000, aliases: ["goat meat", "goat meat portion"], category: "Proteins" },
    { name: "Ponmo (per portion)", price: 400, aliases: ["ponmo"], category: "Proteins" },
    { name: "Stockfish (per portion)", price: 600, aliases: ["stockfish"], category: "Proteins" },
    { name: "Catfish (whole, grilled)", price: 2500, aliases: ["catfish", "whole grilled catfish"], category: "Proteins" },
    { name: "Shaki (Tripe)", price: 600, aliases: ["shaki", "tripe"], category: "Proteins" },
    { name: "Turkey (1 piece)", price: 1500, aliases: ["turkey", "turkey one piece"], category: "Proteins" },
    { name: "Puff Puff (6 pieces)", price: 500, aliases: ["puff puff", "puff puff six pieces"], category: "Small Chops & Appetizers" },
    { name: "Samosa (4 pieces)", price: 600, aliases: ["samosa", "samosa four pieces"], category: "Small Chops & Appetizers" },
    { name: "Spring Rolls (4 pieces)", price: 700, aliases: ["spring rolls", "spring rolls four pieces"], category: "Small Chops & Appetizers" },
    { name: "Gizdodo (Gizzard + Fried Plantain)", price: 1500, aliases: ["gizdodo", "gizzard fried plantain"], category: "Small Chops & Appetizers" },
    { name: "Peppered Gizzard", price: 1200, aliases: ["peppered gizzard"], category: "Small Chops & Appetizers" },
    { name: "Peppered Snail (4 pieces)", price: 2000, aliases: ["peppered snail", "snail"], category: "Small Chops & Appetizers" },
    { name: "Suya (per stick)", price: 500, aliases: ["suya", "suya stick"], category: "Small Chops & Appetizers" },
    { name: "Asun (Peppered Goat Meat)", price: 1800, aliases: ["asun", "peppered goat meat"], category: "Small Chops & Appetizers" },
    { name: "Spaghetti Jollof", price: 1200, aliases: ["spaghetti jollof", "jollof spaghetti"], category: "Pasta & Noodles" },
    { name: "Macaroni + Stew", price: 1000, aliases: ["macaroni stew", "macaroni and stew"], category: "Pasta & Noodles" },
    { name: "Indomie (plain)", price: 600, aliases: ["indomie plain", "plain indomie"], category: "Pasta & Noodles" },
    { name: "Indomie + Egg + Sausage", price: 1000, aliases: ["indomie egg sausage", "indomie with egg and sausage"], category: "Pasta & Noodles" },
    { name: "Akara + Ogi (Pap)", price: 700, aliases: ["akara ogi", "akara and ogi", "pap"], category: "Breakfast" },
    { name: "Moi Moi (2 wraps)", price: 600, aliases: ["moi moi two wraps", "moi moi 2 wraps"], category: "Breakfast" },
    { name: "Yam + Egg Sauce", price: 1000, aliases: ["yam egg sauce", "yam and egg sauce"], category: "Breakfast" },
    { name: "Fried Plantain + Egg", price: 900, aliases: ["fried plantain egg", "plantain and egg"], category: "Breakfast" },
    { name: "Bread + Egg Sauce", price: 700, aliases: ["bread egg sauce", "bread and egg sauce"], category: "Breakfast" },
    { name: "Beans + Plantain", price: 800, aliases: ["beans plantain", "beans and plantain"], category: "Breakfast" },
    { name: "Fried Plantain (Dodo)", price: 500, aliases: ["fried plantain", "dodo"], category: "Sides" },
    { name: "Boiled Plantain", price: 400, aliases: ["boiled plantain"], category: "Sides" },
    { name: "Coleslaw", price: 300, aliases: ["coleslaw"], category: "Sides" },
    { name: "Moi Moi (1 wrap)", price: 300, aliases: ["moi moi one wrap", "moi moi 1 wrap"], category: "Sides" },
    { name: "Extra Stew/Soup", price: 300, aliases: ["extra stew", "extra soup"], category: "Sides" },
  ] satisfies MenuItem[],
};

export type ChatbotKnowledgeBase = {
  restaurant: typeof restaurantKnowledge;
  regularFoodMenu: MenuItem[];
  drinksMenu: KnowledgeCatalogItem[];
  veganMenu: KnowledgeCatalogItem[];
  faqs: CustomerFaq[];
  behaviorRules: ChatbotBehaviorRules;
};

/**
 * Structured staging area for the official information that will arrive in
 * subsequent parts. The existing runtime view above remains intact until
 * official replacement menu data is supplied.
 */
export const chatbotKnowledgeBase: ChatbotKnowledgeBase = {
  restaurant: restaurantKnowledge,
  regularFoodMenu: restaurantKnowledge.menu,
  drinksMenu: [],
  veganMenu: [],
  faqs: [],
  behaviorRules: {
    responseStyle: "natural, polite, brief",
    useExternalAi: false,
    officialSourceOnly: true,
    replaceMenuPricesWhenOfficialDataArrives: true,
    neverInvent: [
      "menu items",
      "prices",
      "delivery fees",
      "delivery times",
      "nutritional values",
      "allergy information",
      "halal certification",
      "promotions",
      "business policies",
    ],
    unavailableInformationResponse:
      "Say that the information is not currently available and direct the customer to WhatsApp.",
    recommendationPolicy:
      "Recommend food only from confirmed menu items using the customer's preferences and budget.",
    dietarySafetyPolicy:
      "Avoid health claims and advise customers to confirm ingredients and dietary suitability with the restaurant.",
    orderingPolicy:
      "Direct customers to the website or WhatsApp and never claim that an order has been placed.",
  },
};