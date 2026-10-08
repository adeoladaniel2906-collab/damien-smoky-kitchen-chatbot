/**
 * Business configuration framework.
 *
 * This module defines the structure for business-specific information
 * that can be reused across multiple restaurant/service businesses.
 *
 * The chatbot engine reads from this configuration rather than containing
 * hard-coded business values. This allows onboarding new businesses by
 * providing a different configuration without changing the chatbot logic.
 *
 * Configuration hierarchy:
 * 1. IBusinessConfig (interface) - defines all configurable aspects
 * 2. businessConfigs (map) - named business profiles
 * 3. getActiveBusinessConfig() - loads the current business configuration
 */

import type { MenuItem } from './knowledge';

/**
 * Complete business configuration structure.
 * Used by all chatbot logic, reply generators, and handoff builders.
 */
export interface IBusinessConfig {
  // Identity and branding
  name: string; // Business legal name
  displayName: string; // Customer-facing business name
  description: string; // Short description/tagline
  currency: string; // Currency symbol (₦, $, €, etc.)
  locale: string; // Locale for number formatting (en-NG, en-US, etc.)

  // Contact information
  phone: string; // Formatted phone (080 32 20 16 72)
  phoneDigits: string; // Digits only (08032201672)
  whatsapp: string; // WhatsApp number (same as phone typically)
  whatsappDigits: string; // WhatsApp digits only
  website: string; // Website URL

  // Location and operations
  address: string; // Full address
  operatingHours: string; // Display format (9:00 AM – 9:00 PM)
  operatingHoursStart: number; // 24-hour format start (9)
  operatingHoursEnd: number; // 24-hour format end (21)

  // Ordering and delivery
  orderingMethods: string[]; // ['website', 'whatsapp', 'phone']
  minimumOrderValue: number; // In cents or smallest currency unit (300000 for ₦3000)
  deliveryAreas: string[]; // ['Lagos State']
  deliveryFee: string; // Display text (variable, flat, etc.)
  estimatedDeliveryTime: string; // "30 minutes"
  supportsDelivery: boolean;
  supportsTakeaway: boolean;

  // Reservations
  supportsReservations: boolean;
  reservationPolicies: {
    advanceNotice: string; // "As early as possible"
    largeGroupMinimum?: number; // If any
    minimumSpend?: string; // If any
  };

  // Menu and products
  menu: MenuItem[];
  veganMenu: MenuItem[];
  specialMenus?: Record<string, MenuItem[]>; // gluten-free, halal, etc.

  // Dietary and allergen information
  allergyPolicy: string; // How to handle allergies
  glutenFreeOptions: string;
  veganOptions: string;
  halalCertified: boolean;

  // Services and features
  supportsEvents: boolean;
  supportsGroupCatering: boolean;
  hasDedicateEventPlanner: boolean;
  hasLoyaltyProgram: boolean;
  hasDriveThrough: boolean;
  hasParking: boolean;
  hasWifi: boolean;
  isAirConditioned: boolean;
  hasOutdoorSeating: boolean;
  familyFriendly: boolean;

  // Chatbot behavior customization
  chatbotTone: 'formal' | 'casual' | 'friendly' | 'professional';
  chatbotMaximumContextLength: number;
  recommendedDishes: string[];
  paymentMethods: string[]; // ['cash', 'card', 'transfer']

  // AI context
  aiSystemPrompt: string; // Context provided to AI model
}

/**
 * Damien's Smoky Kitchen - Nigerian restaurant in Ibafo, Ogun State.
 * This is the first business profile using the system.
 */
const damiensConfig: IBusinessConfig = {
  // Identity
  name: "Damien's Smoky Kitchen",
  displayName: "Damien's Smoky Kitchen",
  description: "Nigerian cuisine in Ibafo",
  currency: '₦',
  locale: 'en-NG',

  // Contact
  phone: '080 32 20 16 72',
  phoneDigits: '08032201672',
  whatsapp: '080 32 20 16 72',
  whatsappDigits: '08032201672',
  website: 'DamienStore.food.com',

  // Location
  address: 'The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State',
  operatingHours: '9:00 AM – 9:00 PM',
  operatingHoursStart: 9,
  operatingHoursEnd: 21,

  // Ordering
  orderingMethods: ['website', 'whatsapp'],
  minimumOrderValue: 300000, // ₦3,000 in kobo
  deliveryAreas: ['Lagos State'],
  deliveryFee: 'Depends on location/distance',
  estimatedDeliveryTime: 'About 30 minutes, depending on location, traffic, and order volume',
  supportsDelivery: true,
  supportsTakeaway: true,

  // Reservations
  supportsReservations: true,
  reservationPolicies: {
    advanceNotice: 'As early as possible',
  },

  // Menu (will be populated separately)
  menu: [],
  veganMenu: [],

  // Dietary
  allergyPolicy: 'Tell staff about allergies before ordering so they can advise about suitable options.',
  glutenFreeOptions: 'Tell us about dietary restrictions when ordering so staff can recommend suitable options.',
  veganOptions: 'Vegan menu available with dedicated vegan items.',
  halalCertified: false,

  // Services
  supportsEvents: true,
  supportsGroupCatering: true,
  hasDedicateEventPlanner: false,
  hasLoyaltyProgram: false,
  hasDriveThrough: true,
  hasParking: true,
  hasWifi: true,
  isAirConditioned: true,
  hasOutdoorSeating: true,
  familyFriendly: true,

  // Chatbot
  chatbotTone: 'friendly',
  chatbotMaximumContextLength: 12000,
  recommendedDishes: 'Jollof Rice, Amala + Ewedu + Gbegiri, and Pounded Yam with a protein.',
  paymentMethods: ['cash', 'bank transfer', 'POS'],

  // AI context
  aiSystemPrompt:
    'You are the helpful kitchen assistant for Damien\'s Smoky Kitchen. Use only the official menu data provided for menu items, categories, dietary options, and prices. Never invent information about menu items, prices, delivery fees, or policies. Always direct customers to WhatsApp or the website for orders.',
};

/**
 * Business configuration registry.
 * Add new business profiles here as they are onboarded.
 */
const businessConfigs: Record<string, IBusinessConfig> = {
  damiens: damiensConfig,
};

/**
 * Get the currently active business configuration.
 *
 * In production, this would load based on:
 * - URL subdomain/path
 * - Environment variable
 * - Request context
 * - Database lookup
 *
 * For now, we default to 'damiens'.
 */
export function getActiveBusinessConfig(businessId?: string): IBusinessConfig {
  const id = businessId || process.env.VITE_BUSINESS_ID || 'damiens';
  const config = businessConfigs[id];

  if (!config) {
    throw new Error(
      `Business configuration not found: ${id}. Available: ${Object.keys(businessConfigs).join(', ')}`,
    );
  }

  return config;
}

/**
 * Register a new business configuration.
 * Used for onboarding and testing multiple businesses.
 */
export function registerBusinessConfig(id: string, config: IBusinessConfig): void {
  businessConfigs[id] = config;
}

/**
 * Get all registered business IDs.
 * Useful for testing and admin interfaces.
 */
export function getRegisteredBusinessIds(): string[] {
  return Object.keys(businessConfigs);
}

/**
 * Helper: set a business as active by ID.
 * For testing purposes.
 */
export function setActiveBusinessForTesting(businessId: string): void {
  if (!businessConfigs[businessId]) {
    throw new Error(`Business ${businessId} not registered`);
  }
  // In a real system, this would update process.env or a global state
  // For now, callers should use getActiveBusinessConfig(businessId) explicitly
}

/**
 * Helper: create a test business configuration.
 * Useful for unit tests.
 */
export function createTestBusinessConfig(overrides: Partial<IBusinessConfig> = {}): IBusinessConfig {
  const defaults: IBusinessConfig = {
    name: 'Test Restaurant',
    displayName: 'Test Restaurant',
    description: 'A test restaurant for unit tests',
    currency: '₦',
    locale: 'en-NG',
    phone: '070 0000 0000',
    phoneDigits: '07000000000',
    whatsapp: '070 0000 0000',
    whatsappDigits: '07000000000',
    website: 'test.example.com',
    address: '123 Test Street, Test City',
    operatingHours: '10:00 AM – 8:00 PM',
    operatingHoursStart: 10,
    operatingHoursEnd: 20,
    orderingMethods: ['website', 'whatsapp'],
    minimumOrderValue: 200000,
    deliveryAreas: ['Test City'],
    deliveryFee: 'Flat ₦500',
    estimatedDeliveryTime: '20 minutes',
    supportsDelivery: true,
    supportsTakeaway: true,
    supportsReservations: true,
    reservationPolicies: { advanceNotice: '24 hours' },
    menu: [],
    veganMenu: [],
    allergyPolicy: 'Contact staff about allergies.',
    glutenFreeOptions: 'Contact staff for gluten-free options.',
    veganOptions: 'Limited vegan options available.',
    halalCertified: false,
    supportsEvents: false,
    supportsGroupCatering: false,
    hasDedicateEventPlanner: false,
    hasLoyaltyProgram: false,
    hasDriveThrough: false,
    hasParking: false,
    hasWifi: false,
    isAirConditioned: false,
    hasOutdoorSeating: false,
    familyFriendly: true,
    chatbotTone: 'friendly',
    chatbotMaximumContextLength: 5000,
    recommendedDishes: 'Test Dish 1, Test Dish 2',
    paymentMethods: ['cash'],
    aiSystemPrompt: 'You are a helpful assistant for Test Restaurant.',
  };

  return { ...defaults, ...overrides };
}

export default getActiveBusinessConfig();
