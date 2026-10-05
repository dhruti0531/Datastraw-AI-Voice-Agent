import assert from 'node:assert';
import { test, describe } from 'node:test';
import { DemoService } from '../services/demoService.js';

describe('Demo Mode & Deterministic Policy Engine Tests', () => {
  test('1. ORD-101 Lookup with Real Tool Execution', () => {
    const res = DemoService.processChatTurn([], 'Where is my order ORD-101?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].name, 'get_order_details');
    assert.strictEqual(res.toolCallsExecuted[0].arguments.order_id, 'ORD-101');
    assert.strictEqual(res.toolCallsExecuted[0].result.found, true);
    assert.ok(res.reply.includes('Out for Delivery'));
    assert.ok(res.reply.includes('BlueDart'));
    assert.ok(res.reply.includes('6 PM today'));
  });

  test('2. ORD-102 Lookup (Delivered 14 days ago)', () => {
    const res = DemoService.processChatTurn([], 'Status of order ORD-102?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].result.data?.status, 'Delivered');
    assert.ok(res.reply.includes('Delivered'));
    assert.ok(res.reply.includes('Delhivery'));
  });

  test('3. ORD-103 Lookup (Processing)', () => {
    const res = DemoService.processChatTurn([], 'Can you check ORD-103?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].result.data?.status, 'Processing');
    assert.ok(res.reply.includes('Processing'));
  });

  test('4. Invalid Order ID Handling (ORD-999)', () => {
    const res = DemoService.processChatTurn([], 'Where is order ORD-999?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].result.found, false);
    assert.ok(res.reply.includes('ORD-999'));
    assert.ok(res.reply.includes("couldn't locate") || res.reply.includes("couldn't find"));
  });

  test('5. Cancellation of Processing Order (ORD-103 - Allowed)', () => {
    const res = DemoService.processChatTurn([], 'Can I cancel ORD-103?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].result.data?.cancellation_eligible, true);
    assert.ok(res.reply.includes('eligible for cancellation'));
    assert.ok(res.reply.includes('initiated the cancellation'));
  });

  test('6. Cancellation of Out for Delivery Order (ORD-101 - Rejected)', () => {
    const res = DemoService.processChatTurn([], 'I want to cancel ORD-101');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].result.data?.cancellation_eligible, false);
    assert.ok(res.reply.includes('cannot be cancelled directly'));
    assert.ok(res.reply.includes('refuse the delivery at your doorstep'));
  });

  test('7. Return after 14 days (ORD-102 - Rejected per 7-day policy)', () => {
    const res = DemoService.processChatTurn([], 'Can I return ORD-102?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].result.data?.return_eligible, false);
    assert.ok(res.reply.includes('7 days'));
    assert.ok(res.reply.includes('outside our return window'));
  });

  test('8. Damaged Item Policy', () => {
    const res = DemoService.processChatTurn([], 'My serum arrived damaged and broken');
    assert.ok(res.reply.includes('48 hours'));
    assert.ok(res.reply.includes('photos'));
    assert.ok(res.reply.includes('replacement'));
  });

  test('9. Cash on Delivery (COD) Policy', () => {
    const res = DemoService.processChatTurn([], 'Do you accept cash on delivery?');
    assert.ok(res.reply.includes('₹2,500'));
    assert.ok(res.reply.includes('UPI'));
  });

  test('10. Shipping Policy Query', () => {
    const res = DemoService.processChatTurn([], 'What are your delivery charges?');
    assert.ok(res.reply.includes('₹499'));
    assert.ok(res.reply.includes('₹50'));
    assert.ok(res.reply.includes('3 to 5 business days'));
  });

  test('11. Out-of-Scope Query Refusal', () => {
    const res = DemoService.processChatTurn([], 'Can you book me a flight to Goa?');
    assert.ok(res.reply.includes('Aura Skincare'));
    assert.ok(res.reply.includes("can't help") || res.reply.includes('only assist'));
  });

  test('12. Multi-Turn Conversation Context (Pronoun "it" linking to ORD-101)', () => {
    // Turn 1: Customer asks where ORD-101 is
    const turn1 = DemoService.processChatTurn([], 'Where is my order ORD-101?');
    assert.strictEqual(turn1.toolCallsExecuted.length, 1);

    // Turn 2: Customer asks to cancel "it"
    const turn2 = DemoService.processChatTurn(turn1.messages, 'Can I cancel it?');
    assert.strictEqual(turn2.toolCallsExecuted.length, 1);
    assert.strictEqual(turn2.toolCallsExecuted[0].arguments.order_id, 'ORD-101');
    assert.ok(turn2.reply.includes('cannot be cancelled directly'));
    assert.ok(turn2.reply.includes('refuse the delivery'));
  });

  test('14. Hinglish Order Tracking Query', () => {
    const res = DemoService.processChatTurn([], 'Mera order ORD-101 kab aayega?');
    assert.strictEqual(res.toolCallsExecuted.length, 1);
    assert.strictEqual(res.toolCallsExecuted[0].arguments.order_id, 'ORD-101');
    assert.ok(res.reply.includes('ORD-101'));
    assert.ok(res.reply.includes('BlueDart'));
    assert.ok(res.reply.includes('6 baje'));
  });

  test('15. Hinglish Multi-Turn Context Cancellation', () => {
    const turn1 = DemoService.processChatTurn([], 'Mera order ORD-101 kab aayega?');
    const turn2 = DemoService.processChatTurn(turn1.messages, 'Isko cancel kar sakte hain?');
    assert.strictEqual(turn2.toolCallsExecuted.length, 1);
    assert.strictEqual(turn2.toolCallsExecuted[0].arguments.order_id, 'ORD-101');
    assert.ok(turn2.reply.includes('cancel nahi ho sakte'));
    assert.ok(turn2.reply.includes('doorstep'));
  });

  test('16. Ambiguous Tracking Request (No Order ID)', () => {
    const res = DemoService.processChatTurn([], 'Where is my order?');
    assert.strictEqual(res.toolCallsExecuted.length, 0); // No guessing
    assert.ok(res.reply.includes('order ID'));
  });

  test('17. Ambiguous Cancellation Request (No Order ID)', () => {
    const res = DemoService.processChatTurn([], 'I want to cancel my order.');
    assert.strictEqual(res.toolCallsExecuted.length, 0);
    assert.ok(res.reply.includes('order ID'));
  });

  test('18. Ambiguous Return Request (No Context / No Order ID)', () => {
    const res = DemoService.processChatTurn([], 'I want to return it.');
    assert.strictEqual(res.toolCallsExecuted.length, 0);
    assert.ok(res.reply.includes('order ID'));
  });
});
