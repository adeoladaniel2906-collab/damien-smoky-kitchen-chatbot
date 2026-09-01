export type MenuItem = {
  name: string;
  price: number | null;
  aliases: string[];
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
    "Jollof Rice Combo, Amala & Gbegiri, and Pounded Yam with Grilled Chicken.",
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
    "Basic dishes start from ₦7,000, while full dishes can cost up to ₦15,000.",
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
    { name: "Okra", price: null, aliases: ["okra", "okra soup"] },
    { name: "Ewedu", price: null, aliases: ["ewedu"] },
    {
      name: "Chicken & Chips",
      price: 4000,
      aliases: ["chicken and chips", "chicken chips"],
    },
    { name: "Shawarma", price: 4000, aliases: ["shawarma"] },
    { name: "Grilled Chicken", price: null, aliases: ["grilled chicken"] },
  ] satisfies MenuItem[],
};