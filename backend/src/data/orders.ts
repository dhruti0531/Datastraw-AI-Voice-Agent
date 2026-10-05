import { Order } from '../models/order.js';

export const MOCK_ORDERS: Record<string, Order> = {
  'ORD-101': {
    id: 'ORD-101',
    customerName: 'Priya Sharma',
    product: 'Vitamin C Serum (30ml)',
    value: 699,
    currency: 'INR',
    status: 'Out for Delivery',
    courier: 'BlueDart',
    trackingNumber: 'BD-982103',
    expectedDelivery: 'Expected by 6 PM today',
    notes: 'BlueDart — BD-982103. Expected by 6 PM today.',
    isEligibleForCancellation: false, // Per policy: Shipped/Out for Delivery cannot be cancelled
    isEligibleForReturn: false, // Not yet delivered
  },
  'ORD-102': {
    id: 'ORD-102',
    customerName: 'Rahul Verma',
    product: 'Hydrating Sunscreen SPF 50',
    value: 499,
    currency: 'INR',
    status: 'Delivered',
    courier: 'Delhivery',
    trackingNumber: 'DL-441029',
    deliveredAt: 'Delivered 14 days ago',
    notes: 'Delhivery — DL-441029. Delivered 14 days ago.',
    isEligibleForCancellation: false, // Already delivered
    isEligibleForReturn: false, // Delivered 14 days ago > 7 days return window
  },
  'ORD-103': {
    id: 'ORD-103',
    customerName: 'Ananya Patel',
    product: 'Green Tea Face Wash + Toner',
    value: 850,
    currency: 'INR',
    status: 'Processing',
    orderedAt: 'Ordered 3 hours ago',
    notes: 'Ordered 3 hours ago. Eligible for cancellation.',
    isEligibleForCancellation: true, // Per policy: Processing orders can be cancelled
    isEligibleForReturn: false, // Not yet delivered
  }
};
