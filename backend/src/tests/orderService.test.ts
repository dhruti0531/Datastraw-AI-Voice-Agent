import assert from 'node:assert';
import { test, describe } from 'node:test';
import { OrderService } from '../services/orderService.js';
import { executeGetOrderDetails } from '../tools/orderTool.js';

describe('OrderService Unit Tests', () => {
  test('normalizeOrderId handles varied formats', () => {
    assert.strictEqual(OrderService.normalizeOrderId('ORD-101'), 'ORD-101');
    assert.strictEqual(OrderService.normalizeOrderId('ord101'), 'ORD-101');
    assert.strictEqual(OrderService.normalizeOrderId('ORD 101'), 'ORD-101');
    assert.strictEqual(OrderService.normalizeOrderId('101'), 'ORD-101');
    assert.strictEqual(OrderService.normalizeOrderId('ord-102'), 'ORD-102');
  });

  test('getOrderById returns accurate record for ORD-101', () => {
    const order = OrderService.getOrderById('ORD-101');
    assert.ok(order);
    assert.strictEqual(order.customerName, 'Priya Sharma');
    assert.strictEqual(order.product, 'Vitamin C Serum (30ml)');
    assert.strictEqual(order.value, 699);
    assert.strictEqual(order.status, 'Out for Delivery');
    assert.strictEqual(order.courier, 'BlueDart');
    assert.strictEqual(order.isEligibleForCancellation, false);
  });

  test('getOrderById returns accurate record for ORD-102', () => {
    const order = OrderService.getOrderById('ORD-102');
    assert.ok(order);
    assert.strictEqual(order.customerName, 'Rahul Verma');
    assert.strictEqual(order.status, 'Delivered');
    assert.strictEqual(order.isEligibleForReturn, false); // 14 days ago > 7 days window
  });

  test('getOrderById returns accurate record for ORD-103', () => {
    const order = OrderService.getOrderById('ORD-103');
    assert.ok(order);
    assert.strictEqual(order.customerName, 'Ananya Patel');
    assert.strictEqual(order.status, 'Processing');
    assert.strictEqual(order.isEligibleForCancellation, true); // Processing is cancellable
  });

  test('getOrderById returns null for invalid order', () => {
    const order = OrderService.getOrderById('ORD-999');
    assert.strictEqual(order, null);
  });
});

describe('OrderTool Execution Tests', () => {
  test('executeGetOrderDetails handles valid ORD-101', () => {
    const res = executeGetOrderDetails('ORD-101');
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.order_id, 'ORD-101');
    assert.strictEqual(res.data?.status, 'Out for Delivery');
    assert.strictEqual(res.data?.cancellation_eligible, false);
  });

  test('executeGetOrderDetails handles valid ORD-103', () => {
    const res = executeGetOrderDetails('ORD-103');
    assert.strictEqual(res.found, true);
    assert.strictEqual(res.order_id, 'ORD-103');
    assert.strictEqual(res.data?.status, 'Processing');
    assert.strictEqual(res.data?.cancellation_eligible, true);
  });

  test('executeGetOrderDetails handles missing order ID', () => {
    const res = executeGetOrderDetails('');
    assert.strictEqual(res.found, false);
    assert.ok(res.error_message?.includes('missing'));
  });

  test('executeGetOrderDetails handles non-existent ORD-999', () => {
    const res = executeGetOrderDetails('ORD-999');
    assert.strictEqual(res.found, false);
    assert.ok(res.error_message?.includes('not found'));
  });
});
