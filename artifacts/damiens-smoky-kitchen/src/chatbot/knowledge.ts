export type MenuItem = {
  name: string;
  price: number | null;
  aliases: string[];
};

export type DrinkItem = {
  name: string;
  aliases: string[];
};

export const restaurantKnowledge = {
  businessName: "Damien's Smoky Kitchen",
  openingHours: "9:00 AM–9:00 PM",
  phone: "080 3220 1672",
  location: "The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State",
  ordering: "Orders are accepted through the website or WhatsApp.",
  delivery: "Delivery is available within Lagos State only.",
  deliveryOutsideLagos: "Delivery outside Lagos State isn't available.",
  menu: [
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
  ] satisfies MenuItem[],
  proposedDrinks: [
    { name: "Zobo", aliases: ["zobo", "hibiscus drink"] },
    { name: "Chapman", aliases: ["chapman"] },
    { name: "Malt", aliases: ["malt", "malt drink"] },
    { name: "Bottled Water", aliases: ["bottled water", "water"] },
  ] satisfies DrinkItem[],
};