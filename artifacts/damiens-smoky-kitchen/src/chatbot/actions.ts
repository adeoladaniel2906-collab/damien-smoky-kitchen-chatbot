/**
 * Action layer for customer service requests.
 * 
 * This module provides structured actions for:
 * - Reservation requests (collect info, validate, track as PENDING)
 * - Order intents (collect items, validate, track as PENDING)
 * - Human handoff (complaints, refunds, dietary questions, uncertainty)
 * 
 * Actions never falsely claim completion. All requests are marked as PENDING
 * until external systems confirm them.
 */

import { z } from 'zod';
import { restaurantKnowledge, regularMenuItems, veganMenuItems } from './knowledge';

/**
 * Unique request ID generator.
 * In production, this would integrate with a real backend.
 */
function generateRequestId(): string {
  return `REQ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Reservation request schema and types.
 */
export const ReservationRequestSchema = z.object({
  id: z.string().describe('Unique request ID'),
  status: z.literal('PENDING').describe('Status is always PENDING until backend confirms'),
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD format'),
  time: z.string().regex(/^\d{2}:\d{2}$/).describe('HH:MM format, 24-hour'),
  partySize: z.number().int().min(1).max(50),
  contactPhone: z.string().regex(/^\d{10,15}$/).describe('Phone number, digits only'),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type ReservationRequest = z.infer<typeof ReservationRequestSchema>;

/**
 * Validate and create a reservation request.
 * Returns structured error messages for missing/invalid fields.
 */
export function createReservationRequest(input: {
  name?: string;
  date?: string;
  time?: string;
  partySize?: number | string;
  contactPhone?: string;
  notes?: string;
}): { success: true; request: ReservationRequest } | { success: false; errors: string[] } {
  const errors: string[] = [];

  if (!input.name?.trim()) {
    errors.push('Name is required.');
  }
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.push('Date is required in YYYY-MM-DD format.');
  }
  if (!input.time || !/^\d{2}:\d{2}$/.test(input.time)) {
    errors.push('Time is required in HH:MM format.');
  }
  if (input.partySize === undefined || input.partySize === '') {
    errors.push('Party size is required.');
  } else {
    const size = typeof input.partySize === 'string' ? parseInt(input.partySize, 10) : input.partySize;
    if (isNaN(size) || size < 1 || size > 50) {
      errors.push('Party size must be a number between 1 and 50.');
    }
  }
  if (!input.contactPhone || !/^\d{10,15}$/.test(input.contactPhone.replace(/\D/g, ''))) {
    errors.push('Contact phone is required (10–15 digits).');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const request: ReservationRequest = {
    id: generateRequestId(),
    status: 'PENDING',
    name: input.name!.trim(),
    date: input.date!,
    time: input.time!,
    partySize: typeof input.partySize === 'string' ? parseInt(input.partySize, 10) : input.partySize!,
    contactPhone: input.contactPhone!.replace(/\D/g, ''),
    notes: input.notes?.trim(),
    createdAt: new Date().toISOString(),
  };

  return { success: true, request };
}

/**
 * Order item schema for menu items with quantities.
 */
export const OrderItemSchema = z.object({
  itemName: z.string().describe('Exact menu item name'),
  quantity: z.number().int().min(1),
  category: z.string().describe('Rice, Swallow, Proteins, etc.'),
  pricePerUnit: z.number().min(0),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * Order intent schema.
 */
export const OrderIntentSchema = z.object({
  id: z.string().describe('Unique order ID'),
  status: z.literal('PENDING').describe('Status is always PENDING until backend confirms'),
  items: z.array(OrderItemSchema).min(1),
  totalPrice: z.number().min(0),
  customerNotes: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type OrderIntent = z.infer<typeof OrderIntentSchema>;

/**
 * Find a menu item by name.
 */
function findMenuItem(itemName: string): (typeof regularMenuItems[number]) | (typeof veganMenuItems[number]) | null {
  const normalizedInput = itemName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  for (const item of regularMenuItems) {
    if (
      item.name.toLowerCase() === normalizedInput ||
      item.aliases.some(alias => alias.toLowerCase() === normalizedInput)
    ) {
      return item;
    }
  }
  
  for (const item of veganMenuItems) {
    if (
      item.name.toLowerCase() === normalizedInput ||
      item.aliases.some(alias => alias.toLowerCase() === normalizedInput)
    ) {
      return item;
    }
  }

  return null;
}

/**
 * Create an order intent from customer items.
 * Validates that all items exist on the menu.
 */
export function createOrderIntent(items: Array<{
  itemName: string;
  quantity: number | string;
}>): { success: true; intent: OrderIntent } | { success: false; errors: string[] } {
  const errors: string[] = [];
  const validatedItems: OrderItem[] = [];
  let totalPrice = 0;

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, errors: ['Order must include at least one item.'] };
  }

  for (const item of items) {
    if (!item.itemName?.trim()) {
      errors.push('Item name is required for each order line.');
      continue;
    }

    const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
    if (isNaN(quantity) || quantity < 1) {
      errors.push(`Quantity for "${item.itemName}" must be at least 1.`);
      continue;
    }

    const menuItem = findMenuItem(item.itemName);
    if (!menuItem) {
      errors.push(`"${item.itemName}" is not available on the menu.`);
      continue;
    }

    if (menuItem.price === null) {
      errors.push(`Price for "${menuItem.name}" is not currently available.`);
      continue;
    }

    validatedItems.push({
      itemName: menuItem.name,
      quantity,
      category: menuItem.category,
      pricePerUnit: menuItem.price,
    });
    totalPrice += menuItem.price * quantity;
  }

  if (errors.length > 0 || validatedItems.length === 0) {
    return { success: false, errors: errors.length > 0 ? errors : ['No valid items in order.'] };
  }

  const intent: OrderIntent = {
    id: generateRequestId(),
    status: 'PENDING',
    items: validatedItems,
    totalPrice,
    createdAt: new Date().toISOString(),
  };

  return { success: true, intent };
}

/**
 * Human handoff reason types.
 */
export const HandoffReasonSchema = z.enum([
  'COMPLAINT',
  'REFUND_REQUEST',
  'DIETARY_QUESTION',
  'ALLERGY_CONCERN',
  'UNCERTAIN_ANSWER',
  'CUSTOM_REQUEST',
  'OTHER',
]);

export type HandoffReason = z.infer<typeof HandoffReasonSchema>;

/**
 * Human handoff request schema.
 */
export const HumanHandoffSchema = z.object({
  id: z.string().describe('Unique handoff ID'),
  status: z.literal('PENDING_HUMAN_REVIEW').describe('Always PENDING until human responds'),
  reason: HandoffReasonSchema,
  description: z.string().min(1),
  customerName: z.string().optional(),
  customerContact: z.string().optional(),
  context: z.record(z.unknown()).optional().describe('Additional context from conversation'),
  createdAt: z.string().datetime(),
});

export type HumanHandoff = z.infer<typeof HumanHandoffSchema>;

/**
 * Create a human handoff request.
 */
export function createHumanHandoff(input: {
  reason: HandoffReason;
  description: string;
  customerName?: string;
  customerContact?: string;
  context?: Record<string, unknown>;
}): HumanHandoff {
  return {
    id: generateRequestId(),
    status: 'PENDING_HUMAN_REVIEW',
    reason: input.reason,
    description: input.description,
    customerName: input.customerName,
    customerContact: input.customerContact,
    context: input.context,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validation errors response.
 */
export type ValidationError = {
  success: false;
  errors: string[];
};

/**
 * Action response discriminator.
 */
export type ActionResult = 
  | { success: true; data: ReservationRequest | OrderIntent | HumanHandoff }
  | { success: false; errors: string[] };
