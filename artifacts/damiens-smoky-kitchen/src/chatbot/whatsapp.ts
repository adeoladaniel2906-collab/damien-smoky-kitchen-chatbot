/**
 * WhatsApp handoff integration for customer service escalations.
 *
 * Generates properly formatted WhatsApp messages with customer context
 * and provides safe handoff URLs that comply with WhatsApp's message format.
 *
 * The handoff flow:
 * 1. Chatbot determines that human assistance is needed
 * 2. buildHandoffMessage() creates a customer-friendly message
 * 3. generateWhatsAppLink() produces a properly encoded URL
 * 4. Frontend presents this to customer as a "Chat with staff" action
 *
 * Never exposes internal implementation details, API keys, or system prompts.
 * Never falsely claims that actions have been completed.
 */

import { restaurantKnowledge, type MenuItem } from './knowledge';
import type { ReservationRequest, OrderIntent, HumanHandoff } from './actions';

/**
 * Centralized WhatsApp contact configuration.
 * Single source of truth for restaurant staff contact information.
 */
export const whatsappConfig = {
  phoneNumber: restaurantKnowledge.phone, // '080 32 20 16 72'
  phoneDigitsOnly: restaurantKnowledge.phone.replace(/\D/g, ''), // '08032201672'
  businessName: restaurantKnowledge.businessName, // "Damien's Smoky Kitchen"
};

/**
 * Handoff message builder interface.
 * Converts structured actions into customer-facing text for WhatsApp.
 */
interface HandoffMessageBuilder {
  title: string;
  lines: string[];
}

/**
 * Format currency for display in messages.
 */
function formatPrice(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

/**
 * Safely encode text for WhatsApp URL query string.
 * Handles ₦, spaces, punctuation, and multiline content.
 */
function encodeWhatsAppText(text: string): string {
  // WhatsApp Web API uses standard URL encoding
  return encodeURIComponent(text);
}

/**
 * Build a handoff message for a complaint.
 */
export function buildComplaintHandoff(description: string): HandoffMessageBuilder {
  return {
    title: 'Complaint',
    lines: [
      `I need to report an issue with my order:`,
      ``,
      description,
      ``,
      `Please help me resolve this.`,
    ],
  };
}

/**
 * Build a handoff message for a refund request.
 */
export function buildRefundHandoff(reason: string): HandoffMessageBuilder {
  return {
    title: 'Refund Request',
    lines: [
      `I would like to request a refund:`,
      ``,
      reason,
      ``,
      `Please review this and let me know the next steps.`,
    ],
  };
}

/**
 * Build a handoff message for an allergy/dietary concern.
 */
export function buildAllergyHandoff(question: string): HandoffMessageBuilder {
  return {
    title: 'Allergy/Dietary Question',
    lines: [
      `I have a dietary or allergy concern:`,
      ``,
      question,
      ``,
      `Please confirm ingredients and suitability before I order.`,
    ],
  };
}

/**
 * Build a handoff message for a reservation request.
 */
export function buildReservationHandoff(
  reservation: ReservationRequest,
): HandoffMessageBuilder {
  const dateObj = new Date(reservation.date);
  const formattedDate = dateObj.toLocaleDateString('en-NG', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return {
    title: 'Reservation Request',
    lines: [
      `I would like to make a reservation:`,
      ``,
      `Name: ${reservation.name}`,
      `Date: ${formattedDate}`,
      `Time: ${reservation.time}`,
      `Party size: ${reservation.partySize}`,
      reservation.notes ? `Notes: ${reservation.notes}` : '',
      ``,
      `Please confirm availability and let me know if you need any additional information.`,
    ].filter(line => line !== ''),
  };
}

/**
 * Build a handoff message for an order intent.
 */
export function buildOrderHandoff(order: OrderIntent): HandoffMessageBuilder {
  const itemLines = order.items.map(
    item => `• ${item.itemName} × ${item.quantity} — ${formatPrice(item.pricePerUnit * item.quantity)}`,
  );

  return {
    title: 'Order Ready for Confirmation',
    lines: [
      `I would like to place this order:`,
      ``,
      ...itemLines,
      ``,
      `Estimated total: ${formatPrice(order.totalPrice)}`,
      ``,
      `Please confirm this order and provide delivery details.`,
    ],
  };
}

/**
 * Build a handoff message for an uncertain or unsupported question.
 */
export function buildUncertainAnswerHandoff(question: string): HandoffMessageBuilder {
  return {
    title: 'Question for Staff',
    lines: [
      `I have a question that I need staff assistance with:`,
      ``,
      question,
      ``,
      `Please help me with this.`,
    ],
  };
}

/**
 * Build a handoff message for an explicit human request.
 */
export function buildExplicitHandoffRequest(reason: string): HandoffMessageBuilder {
  return {
    title: 'Request for Human Assistant',
    lines: [
      reason,
      ``,
      `I'm ready to chat with your team.`,
    ],
  };
}

/**
 * Format a handoff message for display.
 * Returns human-readable text that will be sent to the customer.
 */
export function formatHandoffMessage(message: HandoffMessageBuilder): string {
  return message.lines.join('\n');
}

/**
 * Generate a WhatsApp Web link that pre-fills a message.
 *
 * Format: https://wa.me/PHONENUMBER?text=URLENCODED_MESSAGE
 *
 * @param businessPhone Phone number in format that WhatsApp accepts (digits only, with country code)
 * @param message Human-readable message to pre-fill
 * @returns URL safe for use in href
 */
export function generateWhatsAppLink(businessPhone: string, message: string): string {
  const phoneDigits = businessPhone.replace(/\D/g, '');

  // Ensure proper WhatsApp format: country code + number
  // Nigerian numbers: 234 + remaining digits
  const formattedPhone = phoneDigits.startsWith('234')
    ? phoneDigits
    : phoneDigits.startsWith('0')
      ? '234' + phoneDigits.substring(1) // Convert 080... to 23480...
      : phoneDigits;

  const encodedMessage = encodeWhatsAppText(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

/**
 * Generate a complete handoff response for the customer.
 * Includes clear messaging and a clickable WhatsApp link.
 *
 * Never claims the action has been completed.
 * Always uses "pending" or "ready to send" language.
 */
export function generateHandoffResponse(
  handoff: HandoffMessageBuilder,
  includePhone: boolean = true,
): {
  message: string;
  whatsappLink: string;
  phoneDisplay: string;
} {
  const customerMessage = formatHandoffMessage(handoff);
  const whatsappLink = generateWhatsAppLink(
    whatsappConfig.phoneDigitsOnly,
    customerMessage,
  );
  const phoneDisplay = restaurantKnowledge.phone;

  // Create customer-facing confirmation (WITHOUT exposing the raw message or system details)
  const responseMessage = `Your ${handoff.title.toLowerCase()} is ready to send to the restaurant team on WhatsApp.${
    includePhone ? ` Click below or call ${phoneDisplay}.` : ''
  }`;

  return {
    message: responseMessage,
    whatsappLink,
    phoneDisplay,
  };
}

/**
 * Build a safe customer-facing message that combines:
 * - Clear indication of what's happening
 * - Clickable WhatsApp action
 * - Fallback phone number
 *
 * Used by the frontend to present handoff UI.
 */
export function buildCustomerHandoffUI(
  handoff: HandoffMessageBuilder,
): {
  headline: string;
  description: string;
  whatsappLink: string;
  whatsappPhoneDisplay: string;
  fallbackPhone: string;
} {
  const { message, whatsappLink, phoneDisplay } = generateHandoffResponse(handoff);

  return {
    headline: `Connect with our team`,
    description: message,
    whatsappLink,
    whatsappPhoneDisplay: phoneDisplay,
    fallbackPhone: phoneDisplay,
  };
}

/**
 * Validation: ensure no system prompts, API keys, or internal details leak into messages.
 */
export function validateHandoffMessageSafety(message: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const dangerPatterns = [
    /system|instruction|prompt/i,
    /api[_-]?key|secret|token|credential/i,
    /cloudflare|openai|workers|wrangler/i,
    /database|query|sql/i,
    /env\.|process\.env/i,
    /TODO|FIXME|DEBUG|HACK/,
  ];

  for (const pattern of dangerPatterns) {
    if (pattern.test(message)) {
      issues.push(`Detected potentially unsafe pattern: ${pattern.source}`);
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * Utility: get a human-readable display of WhatsApp contact info.
 */
export function getRestaurantWhatsAppDisplay(): {
  phone: string;
  phoneDigits: string;
  businessName: string;
  action: string;
} {
  return {
    phone: restaurantKnowledge.phone,
    phoneDigits: whatsappConfig.phoneDigitsOnly,
    businessName: whatsappConfig.businessName,
    action: `Chat with ${whatsappConfig.businessName} on WhatsApp`,
  };
}
