import assert from 'node:assert';
import { test, describe } from 'node:test';
import { executeGetOrderDetails } from '../tools/orderTool.js';
import { OrderService } from '../services/orderService.js';
import { ARIA_SYSTEM_PROMPT } from '../prompts/ariaPersona.js';

describe('Assessment Scenarios & Policy Guardrails Verification', () => {
  test('Scenario 1: Order Tracking ORD-101 (Out for Delivery)', () => {
    const res = executeGetOrderDetails('ORD-101');
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.data?.status, 'Out for Delivery');
    assert.strictEqual(res.data?.courier, 'BlueDart');
    assert.ok(res.data?.delivery_info.includes('Expected by 6 PM today'));
  });

  test('Scenario 2: Valid Cancellation ORD-103 (Processing)', () => {
    const res = executeGetOrderDetails('ORD-103');
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.data?.status, 'Processing');
    assert.strictEqual(res.data?.cancellation_eligible, true);
  });

  test('Scenario 3: Invalid Cancellation ORD-101 (Out for Delivery rejection)', () => {
    const res = executeGetOrderDetails('ORD-101');
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.data?.status, 'Out for Delivery');
    assert.strictEqual(res.data?.cancellation_eligible, false);
  });

  test('Scenario 4: Return Policy ORD-102 (Delivered 14 days ago - Rejected)', () => {
    const res = executeGetOrderDetails('ORD-102');
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.data?.status, 'Delivered');
    assert.strictEqual(res.data?.return_eligible, false); // Exceeds 7-day policy
  });

  test('Scenario 5: Invalid Order ORD-999 (Not Found Handling)', () => {
    const res = executeGetOrderDetails('ORD-999');
    assert.strictEqual(res.found, false);
    assert.ok(res.error_message?.includes('not found'));
  });

  test('Scenario 6: Missing Order ID Validation', () => {
    const res = executeGetOrderDetails('');
    assert.strictEqual(res.found, false);
    assert.ok(res.error_message?.includes('missing'));
  });

  test('System Prompt contains strict brand policy guardrails', () => {
    // Brand
    assert.ok(ARIA_SYSTEM_PROMPT.includes('Aura Skincare'));
    // Shipping
    assert.ok(ARIA_SYSTEM_PROMPT.includes('499'));
    assert.ok(ARIA_SYSTEM_PROMPT.includes('50'));
    // Return
    assert.ok(ARIA_SYSTEM_PROMPT.includes('7 days'));
    assert.ok(ARIA_SYSTEM_PROMPT.includes('unopened'));
    // Cancellation
    assert.ok(ARIA_SYSTEM_PROMPT.includes('Processing'));
    assert.ok(ARIA_SYSTEM_PROMPT.includes('Shipped'));
    // COD
    assert.ok(ARIA_SYSTEM_PROMPT.includes('2,500'));
    // Out of scope
    assert.ok(ARIA_SYSTEM_PROMPT.includes('Out of Scope'));
  });
});
