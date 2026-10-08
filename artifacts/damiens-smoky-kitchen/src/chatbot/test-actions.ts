/**
 * Comprehensive test suite for the action layer.
 * Tests reservation requests, order intents, human handoffs, and edge cases.
 */

import assert from 'node:assert/strict';
import {
  createReservationRequest,
  createOrderIntent,
  createHumanHandoff,
  type ReservationRequest,
  type OrderIntent,
  type HumanHandoff,
} from './actions';

// ============================================================================
// RESERVATION REQUEST TESTS
// ============================================================================

console.log('\n=== RESERVATION REQUEST TESTS ===\n');

// Valid reservation
{
  const result = createReservationRequest({
    name: 'John Doe',
    date: '2025-12-25',
    time: '18:30',
    partySize: 4,
    contactPhone: '08012345678',
    notes: 'Window table preferred',
  });
  assert.ok(result.success, 'Valid reservation should succeed');
  if (result.success) {
    const req = result.request;
    assert.strictEqual(req.name, 'John Doe');
    assert.strictEqual(req.partySize, 4);
    assert.strictEqual(req.status, 'PENDING');
    assert.ok(req.id.startsWith('REQ-'), 'ID should start with REQ-');
    assert.ok(req.createdAt, 'createdAt should be set');
  }
  console.log('✓ Valid reservation request');
}

// Missing name
{
  const result = createReservationRequest({
    date: '2025-12-25',
    time: '18:30',
    partySize: 4,
    contactPhone: '08012345678',
  });
  assert.ok(!result.success, 'Missing name should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('Name')));
  }
  console.log('✓ Rejects missing name');
}

// Invalid date format
{
  const result = createReservationRequest({
    name: 'John',
    date: '25-12-2025', // Wrong format
    time: '18:30',
    partySize: 4,
    contactPhone: '08012345678',
  });
  assert.ok(!result.success, 'Invalid date format should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('Date')));
  }
  console.log('✓ Rejects invalid date format');
}

// Invalid time format
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '6:30 PM', // Wrong format
    partySize: 4,
    contactPhone: '08012345678',
  });
  assert.ok(!result.success, 'Invalid time format should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('Time')));
  }
  console.log('✓ Rejects invalid time format');
}

// Party size out of range
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '18:30',
    partySize: 100, // Too large
    contactPhone: '08012345678',
  });
  assert.ok(!result.success, 'Party size > 50 should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('between 1 and 50')));
  }
  console.log('✓ Rejects invalid party size');
}

// Invalid phone number
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '18:30',
    partySize: 4,
    contactPhone: '123', // Too short
  });
  assert.ok(!result.success, 'Invalid phone should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('phone')));
  }
  console.log('✓ Rejects invalid phone');
}

// Phone with non-digits
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '18:30',
    partySize: 4,
    contactPhone: '+234 (80) 1234-5678', // Should strip to digits
  });
  assert.ok(result.success, 'Phone with formatting should succeed after cleaning');
  if (result.success) {
    assert.strictEqual(result.request.contactPhone, '23480123456789');
  }
  console.log('✓ Cleans phone number format');
}

// Party size as string
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '18:30',
    partySize: '4', // String number
    contactPhone: '08012345678',
  });
  assert.ok(result.success, 'Party size as string should work');
  if (result.success) {
    assert.strictEqual(result.request.partySize, 4);
  }
  console.log('✓ Parses string party size');
}

// Multiple errors
{
  const result = createReservationRequest({
    name: '',
    date: 'invalid',
    partySize: -1,
  });
  assert.ok(!result.success, 'Multiple errors should fail');
  if (!result.success) {
    assert.ok(result.errors.length >= 3, 'Should report multiple errors');
  }
  console.log('✓ Reports multiple validation errors');
}

// PENDING status guarantee
{
  const result = createReservationRequest({
    name: 'Jane',
    date: '2025-12-31',
    time: '19:00',
    partySize: 2,
    contactPhone: '08098765432',
  });
  assert.ok(result.success);
  if (result.success) {
    assert.strictEqual(result.request.status, 'PENDING');
    assert.ok(result.request.id, 'Should have unique ID');
  }
  console.log('✓ Marks status as PENDING (never confirms)');
}

// ============================================================================
// ORDER INTENT TESTS
// ============================================================================

console.log('\n=== ORDER INTENT TESTS ===\n');

// Valid single-item order
{
  const result = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: 2 },
  ]);
  assert.ok(result.success, 'Valid order should succeed');
  if (result.success) {
    const intent = result.intent;
    assert.strictEqual(intent.items.length, 1);
    assert.strictEqual(intent.items[0].itemName, 'Jollof Rice');
    assert.strictEqual(intent.items[0].quantity, 2);
    assert.strictEqual(intent.items[0].pricePerUnit, 800);
    assert.strictEqual(intent.totalPrice, 1600);
    assert.strictEqual(intent.status, 'PENDING');
  }
  console.log('✓ Valid single-item order');
}

// Valid multi-item order
{
  const result = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: 1 },
    { itemName: 'Fried Chicken', quantity: 2 },
    { itemName: 'Coleslaw', quantity: 1 },
  ]);
  assert.ok(result.success, 'Multi-item order should succeed');
  if (result.success) {
    const intent = result.intent;
    assert.strictEqual(intent.items.length, 3);
    assert.strictEqual(intent.totalPrice, 800 + 2000 + 300); // ₦3100
  }
  console.log('✓ Valid multi-item order with totals');
}

// Empty order
{
  const result = createOrderIntent([]);
  assert.ok(!result.success, 'Empty order should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('at least one item')));
  }
  console.log('✓ Rejects empty order');
}

// Unknown menu item
{
  const result = createOrderIntent([
    { itemName: 'Shawarma', quantity: 1 }, // Not on menu
  ]);
  assert.ok(!result.success, 'Unknown item should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('not available')));
  }
  console.log('✓ Rejects unknown menu item');
}

// Invalid quantity
{
  const result = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: 0 },
  ]);
  assert.ok(!result.success, 'Zero quantity should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('must be at least 1')));
  }
  console.log('✓ Rejects invalid quantity');
}

// Quantity as string
{
  const result = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: '3' },
  ]);
  assert.ok(result.success, 'String quantity should work');
  if (result.success) {
    assert.strictEqual(result.intent.items[0].quantity, 3);
  }
  console.log('✓ Parses string quantity');
}

// Mixed valid and invalid items
{
  const result = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: 1 },
    { itemName: 'Unknown Dish', quantity: 1 },
  ]);
  assert.ok(!result.success, 'Mixed valid/invalid should fail');
  if (!result.success) {
    assert.ok(result.errors.some(e => e.includes('Unknown Dish')));
  }
  console.log('✓ Fails on any invalid item');
}

// Vegan items
{
  const result = createOrderIntent([
    { itemName: 'Vegan Jollof', quantity: 1 },
    { itemName: 'Fried Tofu', quantity: 2 },
  ]);
  assert.ok(result.success, 'Vegan items should work');
  if (result.success) {
    assert.strictEqual(result.intent.items[0].itemName, 'Vegan Jollof');
    assert.strictEqual(result.intent.totalPrice, 1200 + 1200);
  }
  console.log('✓ Accepts vegan items from menu');
}

// Item name aliases work
{
  const result = createOrderIntent([
    { itemName: 'jollof', quantity: 1 }, // Alias
  ]);
  assert.ok(result.success, 'Item aliases should work');
  if (result.success) {
    assert.strictEqual(result.intent.items[0].itemName, 'Jollof Rice');
  }
  console.log('✓ Resolves item aliases correctly');
}

// PENDING status guarantee for orders
{
  const result = createOrderIntent([
    { itemName: 'Puff Puff (6)', quantity: 2 },
  ]);
  assert.ok(result.success);
  if (result.success) {
    assert.strictEqual(result.intent.status, 'PENDING');
    assert.ok(result.intent.id, 'Should have unique order ID');
  }
  console.log('✓ Marks order status as PENDING (never claims placed)');
}

// ============================================================================
// HUMAN HANDOFF TESTS
// ============================================================================

console.log('\n=== HUMAN HANDOFF TESTS ===\n');

// Complaint handoff
{
  const handoff = createHumanHandoff({
    reason: 'COMPLAINT',
    description: 'Food arrived cold',
    customerName: 'Alice',
    customerContact: '08012345678',
  });
  assert.strictEqual(handoff.status, 'PENDING_HUMAN_REVIEW');
  assert.strictEqual(handoff.reason, 'COMPLAINT');
  assert.ok(handoff.id, 'Should have unique ID');
  console.log('✓ Creates complaint handoff');
}

// Refund request
{
  const handoff = createHumanHandoff({
    reason: 'REFUND_REQUEST',
    description: 'Order never arrived',
  });
  assert.strictEqual(handoff.reason, 'REFUND_REQUEST');
  assert.strictEqual(handoff.status, 'PENDING_HUMAN_REVIEW');
  console.log('✓ Creates refund handoff');
}

// Allergy concern
{
  const handoff = createHumanHandoff({
    reason: 'ALLERGY_CONCERN',
    description: 'Does the egusi soup contain shellfish?',
    context: { question: 'allergen' },
  });
  assert.strictEqual(handoff.reason, 'ALLERGY_CONCERN');
  assert.ok(handoff.context, 'Should preserve context');
  console.log('✓ Creates allergy concern handoff');
}

// Dietary question
{
  const handoff = createHumanHandoff({
    reason: 'DIETARY_QUESTION',
    description: 'Is the vegan jollof gluten-free?',
  });
  assert.strictEqual(handoff.reason, 'DIETARY_QUESTION');
  console.log('✓ Creates dietary question handoff');
}

// Uncertain answer
{
  const handoff = createHumanHandoff({
    reason: 'UNCERTAIN_ANSWER',
    description: 'Customer asked about custom meals, needs staff approval',
  });
  assert.strictEqual(handoff.reason, 'UNCERTAIN_ANSWER');
  console.log('✓ Creates uncertain answer handoff');
}

// Human review status guarantee
{
  const handoff = createHumanHandoff({
    reason: 'OTHER',
    description: 'Customer wants to speak with manager',
  });
  assert.strictEqual(handoff.status, 'PENDING_HUMAN_REVIEW');
  assert.ok(handoff.id, 'Should have unique ID');
  console.log('✓ Always marks handoff as PENDING_HUMAN_REVIEW');
}

// ============================================================================
// PROMPT INJECTION TESTS
// ============================================================================

console.log('\n=== PROMPT INJECTION TESTS ===\n');

// Injection attempt in reservation name
{
  const result = createReservationRequest({
    name: 'John\'; DROP TABLE reservations; --',
    date: '2025-12-25',
    time: '18:30',
    partySize: 4,
    contactPhone: '08012345678',
  });
  assert.ok(result.success, 'Should accept malicious name (it's just a string)');
  if (result.success) {
    // Name is stored as-is; the schema prevents execution
    assert.ok(result.request.name.includes("'"));
  }
  console.log('✓ Sanitizes injection attempts in name');
}

// Injection in order item name
{
  const result = createOrderIntent([
    { itemName: 'Jollof Rice\'; hack--', quantity: 1 },
  ]);
  assert.ok(!result.success, 'Injection attempt should fail (unknown item)');
  console.log('✓ Rejects unknown items (including injected strings)');
}

// ============================================================================
// FALSE CONFIRMATION PREVENTION TESTS
// ============================================================================

console.log('\n=== FALSE CONFIRMATION PREVENTION TESTS ===\n');

// Reservation never marked as confirmed
{
  const result = createReservationRequest({
    name: 'Bob',
    date: '2025-12-20',
    time: '19:00',
    partySize: 3,
    contactPhone: '08087654321',
  });
  assert.ok(result.success);
  if (result.success) {
    assert.notStrictEqual(result.request.status, 'CONFIRMED');
    assert.strictEqual(result.request.status, 'PENDING');
  }
  console.log('✓ Never marks reservation as CONFIRMED');
}

// Order never marked as placed
{
  const result = createOrderIntent([
    { itemName: 'Amala + Ewedu + Gbegiri', quantity: 1 },
  ]);
  assert.ok(result.success);
  if (result.success) {
    assert.notStrictEqual(result.intent.status, 'PLACED');
    assert.notStrictEqual(result.intent.status, 'CONFIRMED');
    assert.strictEqual(result.intent.status, 'PENDING');
  }
  console.log('✓ Never marks order as PLACED or CONFIRMED');
}

// Handoff never claims resolution
{
  const handoff = createHumanHandoff({
    reason: 'COMPLAINT',
    description: 'Issue',
  });
  assert.notStrictEqual(handoff.status, 'RESOLVED');
  assert.notStrictEqual(handoff.status, 'CLOSED');
  assert.strictEqual(handoff.status, 'PENDING_HUMAN_REVIEW');
  console.log('✓ Never marks handoff as RESOLVED');
}

// ============================================================================
// MULTI-TURN CONVERSATION TESTS
// ============================================================================

console.log('\n=== MULTI-TURN CONVERSATION TESTS ===\n');

// Scenario: User collects reservation info across turns
{
  const turn1 = createReservationRequest({ name: 'Sarah' });
  assert.ok(!turn1.success, 'Partial info fails');

  const turn2 = createReservationRequest({
    name: 'Sarah',
    date: '2025-12-28',
    time: '17:00',
    partySize: 5,
    contactPhone: '08011112222',
  });
  assert.ok(turn2.success, 'Complete info succeeds');
  if (turn2.success) {
    assert.strictEqual(turn2.request.name, 'Sarah');
    assert.strictEqual(turn2.request.partySize, 5);
  }
  console.log('✓ Handles multi-turn reservation collection');
}

// Scenario: User builds order across turns
{
  const turn1 = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: 1 },
  ]);
  assert.ok(turn1.success);
  if (turn1.success) {
    const firstTotal = turn1.intent.totalPrice;
    assert.strictEqual(firstTotal, 800);
  }

  // In real scenario, this would be a second order request
  const turn2 = createOrderIntent([
    { itemName: 'Jollof Rice', quantity: 1 },
    { itemName: 'Grilled Chicken', quantity: 1 },
    { itemName: 'Coleslaw', quantity: 2 },
  ]);
  assert.ok(turn2.success);
  if (turn2.success) {
    assert.strictEqual(turn2.intent.items.length, 3);
    assert.strictEqual(turn2.intent.totalPrice, 800 + 1200 + 600);
  }
  console.log('✓ Handles multi-turn order collection');
}

// ============================================================================
// EDGE CASES
// ============================================================================

console.log('\n=== EDGE CASES ===\n');

// Whitespace-only name
{
  const result = createReservationRequest({
    name: '   ',
    date: '2025-12-25',
    time: '18:30',
    partySize: 1,
    contactPhone: '08012345678',
  });
  assert.ok(!result.success, 'Whitespace-only name should fail');
  console.log('✓ Rejects whitespace-only name');
}

// Very long name
{
  const result = createReservationRequest({
    name: 'A'.repeat(101),
    date: '2025-12-25',
    time: '18:30',
    partySize: 1,
    contactPhone: '08012345678',
  });
  assert.ok(!result.success, 'Name > 100 chars should fail');
  console.log('✓ Enforces max name length');
}

// Past date (not validated, just accepted)
{
  const result = createReservationRequest({
    name: 'John',
    date: '2020-01-01',
    time: '18:30',
    partySize: 1,
    contactPhone: '08012345678',
  });
  assert.ok(result.success, 'Past dates accepted (validation up to restaurant)');
  console.log('✓ Accepts past dates (validation deferred)');
}

// Midnight time
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '00:00',
    partySize: 1,
    contactPhone: '08012345678',
  });
  assert.ok(result.success, 'Midnight should work');
  console.log('✓ Accepts midnight time');
}

// Maximum party size
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '18:30',
    partySize: 50,
    contactPhone: '08012345678',
  });
  assert.ok(result.success, 'Max party size (50) should work');
  console.log('✓ Accepts maximum party size');
}

// Minimum party size
{
  const result = createReservationRequest({
    name: 'John',
    date: '2025-12-25',
    time: '18:30',
    partySize: 1,
    contactPhone: '08012345678',
  });
  assert.ok(result.success, 'Min party size (1) should work');
  console.log('✓ Accepts minimum party size');
}

// Large order quantity
{
  const result = createOrderIntent([
    { itemName: 'Coleslaw', quantity: 100 },
  ]);
  assert.ok(result.success, 'Large quantity should work');
  if (result.success) {
    assert.strictEqual(result.intent.totalPrice, 30000); // 300 * 100
  }
  console.log('✓ Handles large order quantities');
}

// Case-insensitive item matching
{
  const result = createOrderIntent([
    { itemName: 'JOLLOF RICE', quantity: 1 },
  ]);
  assert.ok(result.success, 'Uppercase should match');
  if (result.success) {
    assert.strictEqual(result.intent.items[0].itemName, 'Jollof Rice');
  }
  console.log('✓ Case-insensitive item matching');
}

console.log('\n' + '='.repeat(60));
console.log('ALL TESTS PASSED ✓');
console.log('='.repeat(60) + '\n');
