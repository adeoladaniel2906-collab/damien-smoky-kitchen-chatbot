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

export const officialMenuContext = `Damien's Smoky Kitchen

Restaurant information:
- Restaurant: Damien's Smoky Kitchen
- Address: The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State
- Opening hours: 9:00 AM – 9:00 PM
- Orders: Customers can order through the website or WhatsApp.
- WhatsApp: 080 32 20 16 72
- Delivery: Delivery is within Lagos State.
- Minimum delivery order: ₦3,000.
- Delivery fee: Depends on location/distance. Do not invent a delivery fee.
- Estimated delivery time: About 30 minutes, depending on location, traffic, and order volume.

COMPLETE MENU

🍚 RICE
- Jollof Rice — Small ₦800 | Large ₦1,500
- Fried Rice — Small ₦900 | Large ₦1,600
- White Rice + Stew — ₦800
- Coconut Rice — ₦1,200
- Ofada + Ayamase — ₦1,500

🥣 SWALLOW
- Eba + Egusi — ₦1,000
- Eba + Okra — ₦1,000
- Eba + Bitterleaf — ₦1,000
- Pounded Yam + Egusi — ₦1,500
- Pounded Yam + Oha — ₦1,600
- Amala + Ewedu + Gbegiri — ₦1,200
- Tuwo + Miyan Kuka — ₦1,000
- Fufu + Ogbono — ₦1,000

🍗 PROTEINS
- Grilled Chicken — ₦1,200
- Fried Chicken — ₦1,000
- Beef — ₦800
- Goat Meat — ₦1,000
- Ponmo — ₦400
- Stockfish — ₦600
- Whole Grilled Catfish — ₦2,500
- Shaki — ₦600
- Turkey — ₦1,500

🥟 SMALL CHOPS
- Puff Puff (6) — ₦500
- Samosa (4) — ₦600
- Spring Rolls (4) — ₦700
- Gizdodo — ₦1,500
- Peppered Gizzard — ₦1,200
- Peppered Snail (4) — ₦2,000
- Suya Stick — ₦500
- Asun — ₦1,800

🍝 PASTA & NOODLES
- Spaghetti Jollof — ₦1,200
- Macaroni + Stew — ₦1,000
- Indomie Plain — ₦600
- Indomie + Egg + Sausage — ₦1,000

🍳 BREAKFAST
- Akara + Ogi — ₦700
- Moi Moi (2 wraps) — ₦600
- Yam + Egg Sauce — ₦1,000
- Fried Plantain + Egg — ₦900
- Bread + Egg Sauce — ₦700
- Beans + Plantain — ₦800

🍌 SIDES
- Fried Plantain — ₦500
- Boiled Plantain — ₦400
- Coleslaw — ₦300
- Moi Moi (1 wrap) — ₦300
- Extra Stew/Soup — ₦300

🥤 DRINKS
- Coke 35cl — ₦400
- Coke 50cl — ₦600
- Fanta 35cl — ₦400
- Sprite 35cl — ₦400
- Pepsi 35cl — ₦400
- Mirinda 35cl — ₦400
- Schweppes Chapman — ₦500
- Water 50cl — ₦200
- Water 75cl — ₦300
- Sparkling Water — ₦500
- Chivita — ₦500
- Five Alive — ₦500
- Hollandia — ₦600
- Fresh Orange Juice — ₦700
- Watermelon Smoothie — ₦800
- Banana Smoothie — ₦800
- Mixed Fruit Smoothie — ₦1,000
- Lipton — ₦300
- Bournvita — ₦400
- Milo — ₦400
- Nescafé — ₦500
- Zobo — ₦300 glass / ₦500 bottle
- Kunu — ₦300 glass / ₦500 bottle
- Tigernut — ₦500
- Sobo — ₦300

🍺 ALCOHOLIC DRINKS
- Star — ₦800
- Heineken — ₦900
- Guinness — ₦900
- Trophy — ₦700
- Orijin — ₦900
- Alomo Shot — ₦400
- Hero — ₦700
- Smirnoff Ice — ₦1,000

🌱 VEGAN MENU
RICE
- Vegan Jollof — ₦1,200
- Vegan Fried Rice — ₦1,300
- Coconut Rice + Stewed Veg — ₦1,200
- White Rice + Vegan Tomato Stew — ₦900

SWALLOW
- Eba + Vegetable Egusi — ₦1,200
- Eba + Okra — ₦1,100
- Pounded Yam + Ogbono — ₦1,500
- Amala + Ewedu — ₦1,200
- Fufu + Vegetable Soup — ₦1,100

VEGAN PROTEINS
- Soy Chunks — ₦500
- Fried Tofu — ₦600
- Peppered Tofu — ₦800
- Mushroom Stir Fry — ₦700
- Garden Egg Stew — ₦500
- Black-eyed Bean Patties (2) — ₦600

VEGAN BREAKFAST
- Vegan Akara — ₦700
- Vegan Moi Moi — ₦600
- Boiled Yam + Garden Egg Sauce — ₦900
- Fried Plantain + Avocado — ₦800
- Oatmeal + Banana + Groundnuts — ₦700
- Beans Porridge — ₦800

VEGAN SMALL CHOPS
- Vegan Puff Puff — ₦500
- Vegan Spring Rolls — ₦700
- Vegan Samosa — ₦600
- Boli + Groundnut — ₦600
- Boiled Groundnuts — ₦300
- Roasted Corn — ₦400

VEGAN SIDES
- Steamed Vegetables — ₦500
- Fried Plantain — ₦500
- Boiled Plantain — ₦400
- Avocado Salad — ₦700
- Garden Salad — ₦600
- Roasted Sweet Potato — ₦500

VEGAN DRINKS
- Zobo — ₦300–₦500
- Kunu — ₦300–₦500
- Tigernut — ₦500
- Fresh Watermelon Juice — ₦700
- Fresh Orange — ₦700
- Banana Smoothie — ₦800
- Mixed Fruit Smoothie — ₦1,000
- Coconut Water — ₦500

CHATBOT BEHAVIOUR:
- Answer menu questions using ONLY the knowledge supplied above.
- Give exact prices when known.
- Clearly distinguish regular and vegan menu items.
- Explain that prices are in Nigerian Naira.
- Help customers find food based on preferences.
- Answer questions about delivery, ordering, opening hours, address, and WhatsApp.
- Never invent information.
- Never invent unavailable menu items.
- Never invent delivery fees.
- Never claim an item is vegan unless the knowledge base identifies it as vegan.
- If information is not available, honestly say that the information is not provided in the restaurant knowledge base.
- For "Show me the full menu", provide the complete menu, organized by category.
- Keep responses readable rather than producing one huge unstructured paragraph.`;

export const regularMenuItems: MenuItem[] = [
  { name: 'Jollof Rice', price: 800, aliases: ['jollof rice', 'small jollof'], category: 'Rice' },
  { name: 'Jollof Rice', price: 1500, aliases: ['large jollof rice', 'large jollof'], category: 'Rice' },
  { name: 'Fried Rice', price: 900, aliases: ['fried rice', 'small fried rice'], category: 'Rice' },
  { name: 'Fried Rice', price: 1600, aliases: ['large fried rice'], category: 'Rice' },
  { name: 'White Rice + Stew', price: 800, aliases: ['white rice and stew', 'white rice + stew'], category: 'Rice' },
  { name: 'Coconut Rice', price: 1200, aliases: ['coconut rice'], category: 'Rice' },
  { name: 'Ofada + Ayamase', price: 1500, aliases: ['ofada', 'ofada rice', 'ayamase'], category: 'Rice' },
  { name: 'Eba + Egusi', price: 1000, aliases: ['eba and egusi', 'eba + egusi'], category: 'Swallow' },
  { name: 'Eba + Okra', price: 1000, aliases: ['eba and okra', 'eba + okra'], category: 'Swallow' },
  { name: 'Eba + Bitterleaf', price: 1000, aliases: ['eba and bitterleaf', 'eba + bitterleaf'], category: 'Swallow' },
  { name: 'Pounded Yam + Egusi', price: 1500, aliases: ['pounded yam and egusi', 'pounded yam + egusi'], category: 'Swallow' },
  { name: 'Pounded Yam + Oha', price: 1600, aliases: ['pounded yam and oha', 'pounded yam + oha'], category: 'Swallow' },
  { name: 'Amala + Ewedu + Gbegiri', price: 1200, aliases: ['amala', 'amala and ewedu and gbegiri'], category: 'Swallow' },
  { name: 'Tuwo + Miyan Kuka', price: 1000, aliases: ['tuwo', 'miyan kuka', 'tuwo + miyan kuka'], category: 'Swallow' },
  { name: 'Fufu + Ogbono', price: 1000, aliases: ['fufu', 'fufu and ogbono'], category: 'Swallow' },
  { name: 'Grilled Chicken', price: 1200, aliases: ['grilled chicken'], category: 'Proteins' },
  { name: 'Fried Chicken', price: 1000, aliases: ['fried chicken'], category: 'Proteins' },
  { name: 'Beef', price: 800, aliases: ['beef'], category: 'Proteins' },
  { name: 'Goat Meat', price: 1000, aliases: ['goat meat'], category: 'Proteins' },
  { name: 'Ponmo', price: 400, aliases: ['ponmo'], category: 'Proteins' },
  { name: 'Stockfish', price: 600, aliases: ['stockfish'], category: 'Proteins' },
  { name: 'Whole Grilled Catfish', price: 2500, aliases: ['whole grilled catfish', 'catfish'], category: 'Proteins' },
  { name: 'Shaki', price: 600, aliases: ['shaki'], category: 'Proteins' },
  { name: 'Turkey', price: 1500, aliases: ['turkey'], category: 'Proteins' },
  { name: 'Puff Puff (6)', price: 500, aliases: ['puff puff'], category: 'Small Chops' },
  { name: 'Samosa (4)', price: 600, aliases: ['samosa'], category: 'Small Chops' },
  { name: 'Spring Rolls (4)', price: 700, aliases: ['spring rolls'], category: 'Small Chops' },
  { name: 'Gizdodo', price: 1500, aliases: ['gizdodo'], category: 'Small Chops' },
  { name: 'Peppered Gizzard', price: 1200, aliases: ['peppered gizzard'], category: 'Small Chops' },
  { name: 'Peppered Snail (4)', price: 2000, aliases: ['peppered snail', 'snail'], category: 'Small Chops' },
  { name: 'Suya Stick', price: 500, aliases: ['suya stick', 'suya'], category: 'Small Chops' },
  { name: 'Asun', price: 1800, aliases: ['asun'], category: 'Small Chops' },
  { name: 'Spaghetti Jollof', price: 1200, aliases: ['spaghetti jollof'], category: 'Pasta & Noodles' },
  { name: 'Macaroni + Stew', price: 1000, aliases: ['macaroni and stew'], category: 'Pasta & Noodles' },
  { name: 'Indomie Plain', price: 600, aliases: ['indomie plain'], category: 'Pasta & Noodles' },
  { name: 'Indomie + Egg + Sausage', price: 1000, aliases: ['indomie and egg and sausage'], category: 'Pasta & Noodles' },
  { name: 'Akara + Ogi', price: 700, aliases: ['akara and ogi', 'akara + ogi'], category: 'Breakfast' },
  { name: 'Moi Moi (2 wraps)', price: 600, aliases: ['moi moi'], category: 'Breakfast' },
  { name: 'Yam + Egg Sauce', price: 1000, aliases: ['yam and egg sauce'], category: 'Breakfast' },
  { name: 'Fried Plantain + Egg', price: 900, aliases: ['fried plantain and egg'], category: 'Breakfast' },
  { name: 'Bread + Egg Sauce', price: 700, aliases: ['bread and egg sauce'], category: 'Breakfast' },
  { name: 'Beans + Plantain', price: 800, aliases: ['beans and plantain'], category: 'Breakfast' },
  { name: 'Fried Plantain', price: 500, aliases: ['fried plantain', 'dodo'], category: 'Sides' },
  { name: 'Boiled Plantain', price: 400, aliases: ['boiled plantain'], category: 'Sides' },
  { name: 'Coleslaw', price: 300, aliases: ['coleslaw'], category: 'Sides' },
  { name: 'Moi Moi (1 wrap)', price: 300, aliases: ['moi moi one wrap'], category: 'Sides' },
  { name: 'Extra Stew/Soup', price: 300, aliases: ['extra stew', 'extra soup'], category: 'Sides' },
  { name: 'Coke 35cl', price: 400, aliases: ['coke 35cl', 'coke'], category: 'Drinks' },
  { name: 'Coke 50cl', price: 600, aliases: ['coke 50cl'], category: 'Drinks' },
  { name: 'Fanta 35cl', price: 400, aliases: ['fanta'], category: 'Drinks' },
  { name: 'Sprite 35cl', price: 400, aliases: ['sprite'], category: 'Drinks' },
  { name: 'Pepsi 35cl', price: 400, aliases: ['pepsi'], category: 'Drinks' },
  { name: 'Mirinda 35cl', price: 400, aliases: ['mirinda'], category: 'Drinks' },
  { name: 'Schweppes Chapman', price: 500, aliases: ['schweppes chapman', 'chapman'], category: 'Drinks' },
  { name: 'Water 50cl', price: 200, aliases: ['water 50cl', 'water'], category: 'Drinks' },
  { name: 'Water 75cl', price: 300, aliases: ['water 75cl'], category: 'Drinks' },
  { name: 'Sparkling Water', price: 500, aliases: ['sparkling water'], category: 'Drinks' },
  { name: 'Chivita', price: 500, aliases: ['chivita'], category: 'Drinks' },
  { name: 'Five Alive', price: 500, aliases: ['five alive'], category: 'Drinks' },
  { name: 'Hollandia', price: 600, aliases: ['hollandia'], category: 'Drinks' },
  { name: 'Fresh Orange Juice', price: 700, aliases: ['fresh orange juice'], category: 'Drinks' },
  { name: 'Watermelon Smoothie', price: 800, aliases: ['watermelon smoothie'], category: 'Drinks' },
  { name: 'Banana Smoothie', price: 800, aliases: ['banana smoothie'], category: 'Drinks' },
  { name: 'Mixed Fruit Smoothie', price: 1000, aliases: ['mixed fruit smoothie'], category: 'Drinks' },
  { name: 'Lipton', price: 300, aliases: ['lipton'], category: 'Drinks' },
  { name: 'Bournvita', price: 400, aliases: ['bournvita'], category: 'Drinks' },
  { name: 'Milo', price: 400, aliases: ['milo'], category: 'Drinks' },
  { name: 'Nescafé', price: 500, aliases: ['nescafe'], category: 'Drinks' },
  { name: 'Zobo', price: 300, aliases: ['zobo glass'], category: 'Drinks' },
  { name: 'Zobo', price: 500, aliases: ['zobo bottle'], category: 'Drinks' },
  { name: 'Kunu', price: 300, aliases: ['kunu glass'], category: 'Drinks' },
  { name: 'Kunu', price: 500, aliases: ['kunu bottle'], category: 'Drinks' },
  { name: 'Tigernut', price: 500, aliases: ['tigernut'], category: 'Drinks' },
  { name: 'Sobo', price: 300, aliases: ['sobo'], category: 'Drinks' },
  { name: 'Star', price: 800, aliases: ['star'], category: 'Alcoholic Drinks' },
  { name: 'Heineken', price: 900, aliases: ['heineken'], category: 'Alcoholic Drinks' },
  { name: 'Guinness', price: 900, aliases: ['guinness'], category: 'Alcoholic Drinks' },
  { name: 'Trophy', price: 700, aliases: ['trophy'], category: 'Alcoholic Drinks' },
  { name: 'Orijin', price: 900, aliases: ['orijin'], category: 'Alcoholic Drinks' },
  { name: 'Alomo Shot', price: 400, aliases: ['alomo shot'], category: 'Alcoholic Drinks' },
  { name: 'Hero', price: 700, aliases: ['hero'], category: 'Alcoholic Drinks' },
  { name: 'Smirnoff Ice', price: 1000, aliases: ['smirnoff ice'], category: 'Alcoholic Drinks' },
] as const;

export const veganMenuItems: MenuItem[] = [
  { name: 'Vegan Jollof', price: 1200, aliases: ['vegan jollof'], category: 'Vegan Rice' },
  { name: 'Vegan Fried Rice', price: 1300, aliases: ['vegan fried rice'], category: 'Vegan Rice' },
  { name: 'Coconut Rice + Stewed Veg', price: 1200, aliases: ['coconut rice with stewed veg'], category: 'Vegan Rice' },
  { name: 'White Rice + Vegan Tomato Stew', price: 900, aliases: ['white rice + vegan tomato stew'], category: 'Vegan Rice' },
  { name: 'Eba + Vegetable Egusi', price: 1200, aliases: ['eba + vegetable egusi'], category: 'Vegan Swallow' },
  { name: 'Eba + Okra', price: 1100, aliases: ['vegan eba and okra'], category: 'Vegan Swallow' },
  { name: 'Pounded Yam + Ogbono', price: 1500, aliases: ['pounded yam + ogbono'], category: 'Vegan Swallow' },
  { name: 'Amala + Ewedu', price: 1200, aliases: ['amala + ewedu'], category: 'Vegan Swallow' },
  { name: 'Fufu + Vegetable Soup', price: 1100, aliases: ['fufu + vegetable soup'], category: 'Vegan Swallow' },
  { name: 'Soy Chunks', price: 500, aliases: ['soy chunks'], category: 'Vegan Proteins' },
  { name: 'Fried Tofu', price: 600, aliases: ['fried tofu'], category: 'Vegan Proteins' },
  { name: 'Peppered Tofu', price: 800, aliases: ['peppered tofu'], category: 'Vegan Proteins' },
  { name: 'Mushroom Stir Fry', price: 700, aliases: ['mushroom stir fry'], category: 'Vegan Proteins' },
  { name: 'Garden Egg Stew', price: 500, aliases: ['garden egg stew'], category: 'Vegan Proteins' },
  { name: 'Black-eyed Bean Patties (2)', price: 600, aliases: ['black eyed bean patties'], category: 'Vegan Proteins' },
  { name: 'Vegan Akara', price: 700, aliases: ['vegan akara'], category: 'Vegan Breakfast' },
  { name: 'Vegan Moi Moi', price: 600, aliases: ['vegan moi moi'], category: 'Vegan Breakfast' },
  { name: 'Boiled Yam + Garden Egg Sauce', price: 900, aliases: ['boiled yam and garden egg sauce'], category: 'Vegan Breakfast' },
  { name: 'Fried Plantain + Avocado', price: 800, aliases: ['fried plantain and avocado'], category: 'Vegan Breakfast' },
  { name: 'Oatmeal + Banana + Groundnuts', price: 700, aliases: ['oatmeal banana groundnuts'], category: 'Vegan Breakfast' },
  { name: 'Beans Porridge', price: 800, aliases: ['beans porridge'], category: 'Vegan Breakfast' },
  { name: 'Vegan Puff Puff', price: 500, aliases: ['vegan puff puff'], category: 'Vegan Small Chops' },
  { name: 'Vegan Spring Rolls', price: 700, aliases: ['vegan spring rolls'], category: 'Vegan Small Chops' },
  { name: 'Vegan Samosa', price: 600, aliases: ['vegan samosa'], category: 'Vegan Small Chops' },
  { name: 'Boli + Groundnut', price: 600, aliases: ['boli and groundnut'], category: 'Vegan Small Chops' },
  { name: 'Boiled Groundnuts', price: 300, aliases: ['boiled groundnuts'], category: 'Vegan Small Chops' },
  { name: 'Roasted Corn', price: 400, aliases: ['roasted corn'], category: 'Vegan Small Chops' },
  { name: 'Steamed Vegetables', price: 500, aliases: ['steamed vegetables'], category: 'Vegan Sides' },
  { name: 'Fried Plantain', price: 500, aliases: ['fried plantain'], category: 'Vegan Sides' },
  { name: 'Boiled Plantain', price: 400, aliases: ['boiled plantain'], category: 'Vegan Sides' },
  { name: 'Avocado Salad', price: 700, aliases: ['avocado salad'], category: 'Vegan Sides' },
  { name: 'Garden Salad', price: 600, aliases: ['garden salad'], category: 'Vegan Sides' },
  { name: 'Roasted Sweet Potato', price: 500, aliases: ['roasted sweet potato'], category: 'Vegan Sides' },
  { name: 'Zobo', price: 300, aliases: ['vegan zobo'], category: 'Vegan Drinks' },
  { name: 'Kunu', price: 300, aliases: ['vegan kunu'], category: 'Vegan Drinks' },
  { name: 'Tigernut', price: 500, aliases: ['tigernut'], category: 'Vegan Drinks' },
  { name: 'Fresh Watermelon Juice', price: 700, aliases: ['fresh watermelon juice'], category: 'Vegan Drinks' },
  { name: 'Fresh Orange', price: 700, aliases: ['fresh orange'], category: 'Vegan Drinks' },
  { name: 'Banana Smoothie', price: 800, aliases: ['banana smoothie'], category: 'Vegan Drinks' },
  { name: 'Mixed Fruit Smoothie', price: 1000, aliases: ['mixed fruit smoothie'], category: 'Vegan Drinks' },
  { name: 'Coconut Water', price: 500, aliases: ['coconut water'], category: 'Vegan Drinks' },
] as const;

export const restaurantKnowledge = {
  businessName: "Damien's Smoky Kitchen",
  businessTagline: "Damien's Smoky Kitchen",
  address: "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
  openingHours: "9:00 AM – 9:00 PM",
  ordering: "Customers can order through the website or WhatsApp.",
  phone: "080 32 20 16 72",
  website: "DamienStore.food.com",
  location: "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
  delivery: "Delivery is within Lagos State.",
  minimumDeliveryOrder: 3000,
  deliveryFee: "Delivery fee depends on location/distance.",
  deliveryTime: "Estimated delivery time is about 30 minutes, depending on location, traffic, and order volume.",
  menu: regularMenuItems,
  drinksMenu: [
    { name: 'Coke 35cl', price: 400, aliases: ['coke'], category: 'Drinks' },
    { name: 'Coke 50cl', price: 600, aliases: ['coke 50cl'], category: 'Drinks' },
    { name: 'Fanta 35cl', price: 400, aliases: ['fanta'], category: 'Drinks' },
    { name: 'Sprite 35cl', price: 400, aliases: ['sprite'], category: 'Drinks' },
    { name: 'Pepsi 35cl', price: 400, aliases: ['pepsi'], category: 'Drinks' },
    { name: 'Mirinda 35cl', price: 400, aliases: ['mirinda'], category: 'Drinks' },
    { name: 'Schweppes Chapman', price: 500, aliases: ['schweppes chapman'], category: 'Drinks' },
    { name: 'Water 50cl', price: 200, aliases: ['water 50cl'], category: 'Drinks' },
    { name: 'Water 75cl', price: 300, aliases: ['water 75cl'], category: 'Drinks' },
    { name: 'Sparkling Water', price: 500, aliases: ['sparkling water'], category: 'Drinks' },
    { name: 'Chivita', price: 500, aliases: ['chivita'], category: 'Drinks' },
    { name: 'Five Alive', price: 500, aliases: ['five alive'], category: 'Drinks' },
    { name: 'Hollandia', price: 600, aliases: ['hollandia'], category: 'Drinks' },
    { name: 'Fresh Orange Juice', price: 700, aliases: ['fresh orange juice'], category: 'Drinks' },
    { name: 'Watermelon Smoothie', price: 800, aliases: ['watermelon smoothie'], category: 'Drinks' },
    { name: 'Banana Smoothie', price: 800, aliases: ['banana smoothie'], category: 'Drinks' },
    { name: 'Mixed Fruit Smoothie', price: 1000, aliases: ['mixed fruit smoothie'], category: 'Drinks' },
    { name: 'Lipton', price: 300, aliases: ['lipton'], category: 'Drinks' },
    { name: 'Bournvita', price: 400, aliases: ['bournvita'], category: 'Drinks' },
    { name: 'Milo', price: 400, aliases: ['milo'], category: 'Drinks' },
    { name: 'Nescafé', price: 500, aliases: ['nescafe'], category: 'Drinks' },
    { name: 'Zobo', price: 300, aliases: ['zobo glass'], category: 'Drinks' },
    { name: 'Zobo', price: 500, aliases: ['zobo bottle'], category: 'Drinks' },
    { name: 'Kunu', price: 300, aliases: ['kunu glass'], category: 'Drinks' },
    { name: 'Kunu', price: 500, aliases: ['kunu bottle'], category: 'Drinks' },
    { name: 'Tigernut', price: 500, aliases: ['tigernut'], category: 'Drinks' },
    { name: 'Sobo', price: 300, aliases: ['sobo'], category: 'Drinks' },
  ],
  veganMenu: veganMenuItems,
  drinksAndDesserts: 'Drinks are available. Ask for current drink options and prices.',
  veganOptions: 'The vegan menu includes Vegan Jollof, Vegan Fried Rice, Eba + Vegetable Egusi, Pounded Yam + Ogbono, Soy Chunks, Fried Tofu, and other vegan dishes and drinks listed in the vegan menu.',
  vegetarianOptions: 'The regular menu includes meat-free options such as Eba + Egusi, Eba + Okra, and White Rice + Stew; vegan items are listed separately in the vegan menu.',
  glutenFreeOptions: 'Tell us about dietary restrictions when ordering so staff can recommend suitable options.',
  halalAdvice: 'Confirm the current halal status of specific meat items before ordering.',
  allergyAdvice: 'Tell staff about allergies before ordering so they can advise about suitable options.',
  customDietary: 'Custom meals may be possible. Explain dietary requirements when placing the order.',
  publicHolidayHours: 'Yes, we are open on public holidays during our normal operating hours.',
  recommendedDishes: 'Jollof Rice, Amala + Ewedu + Gbegiri, and Pounded Yam with a protein.',
  kidsMenu: 'No dedicated kids menu is currently available.',
  menuUpdates: 'The menu may be updated periodically based on availability and customer demand.',
  menuOnline: 'Customers can view the menu and place orders through the website.',
  mealPricing: 'Menu prices vary by item and portion. Ask about a specific menu item for its current price.',
  reservations: 'Reservations are available through WhatsApp. Contact us as early as possible to book.',
  largeGroupBookings: 'Large group bookings are available depending on availability and group size. Contact us directly to confirm.',
  reservationMinimumSpend: 'There may be a minimum spend depending on the booking. Confirm the amount when making the reservation.',
  reservationChanges: 'Contact us as soon as possible to cancel or reschedule a reservation.',
  takeaway: 'Takeaway orders are available.',
  deliveryOutsideLagos: "Delivery outside Lagos State isn't available.",
  deliveryTracking: 'Orders can be tracked through the website when tracking is available.',
  privateEvents: 'Private events and special occasions can be discussed with the restaurant.',
  birthdayPackage: "Birthday arrangements are available depending on the customer's requirements.",
  outsideCatering: 'Outside-event catering can be discussed with the restaurant.',
  eventPlanner: 'No dedicated event planner is currently available, but staff can assist with event arrangements.',
  paymentMethods: 'Cash, bank transfer, and POS are accepted, subject to availability.',
  onlinePayment: 'Online payment can be made through the website when available.',
  splitBills: 'Split payments can be accommodated where practical. Inform staff before payment.',
  serviceFee: 'Any applicable service charges will be communicated before payment.',
  familyFriendly: "Damien's Smoky Kitchen welcomes families and couples.",
  outdoorSeating: 'Outdoor seating may be available depending on capacity and weather.',
  wifi: 'Wi-Fi is available for customers.',
  entertainment: 'Background music may be provided. Live entertainment is not currently a standard service.',
  airConditioning: 'The indoor dining area is air-conditioned.',
  loyaltyProgram: 'No dedicated loyalty program is currently available.',
  promotions: 'Promotions may be offered from time to time. Check the website or contact us for current offers.',
  discounts: 'Student and corporate discounts are not guaranteed. Contact us about current offers.',
  updates: 'Check the website or WhatsApp for the latest news and offers.',
  parking: 'Yes, parking is available for customers.',
  driveThrough: 'Yes.',
};

export type ChatbotKnowledgeBase = {
  restaurant: typeof restaurantKnowledge;
  regularFoodMenu: MenuItem[];
  drinksMenu: KnowledgeCatalogItem[];
  veganMenu: KnowledgeCatalogItem[];
  faqs: CustomerFaq[];
  behaviorRules: ChatbotBehaviorRules;
};

export const chatbotKnowledgeBase: ChatbotKnowledgeBase = {
  restaurant: restaurantKnowledge,
  regularFoodMenu: restaurantKnowledge.menu,
  drinksMenu: restaurantKnowledge.drinksMenu,
  veganMenu: restaurantKnowledge.veganMenu,
  faqs: [],
  behaviorRules: {
    responseStyle: 'natural, polite, brief',
    useExternalAi: false,
    officialSourceOnly: true,
    replaceMenuPricesWhenOfficialDataArrives: true,
    neverInvent: [
      'menu items',
      'prices',
      'delivery fees',
      'delivery times',
      'nutritional values',
      'allergy information',
      'halal certification',
      'promotions',
      'business policies',
    ],
    unavailableInformationResponse: 'Say that the information is not currently available and direct the customer to WhatsApp.',
    recommendationPolicy: 'Recommend food only from confirmed menu items using the customer\'s preferences and budget.',
    dietarySafetyPolicy: 'Avoid health claims and advise customers to confirm ingredients and dietary suitability with the restaurant.',
    orderingPolicy: 'Direct customers to the website or WhatsApp and never claim that an order has been placed.',
  },
};