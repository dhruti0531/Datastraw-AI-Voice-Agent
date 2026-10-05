import { Order } from '../models/order.js';
import { MOCK_ORDERS } from '../data/orders.js';

export class OrderService {
  /**
   * Normalizes input order ID string (handles 'ORD-101', 'ord101', 'ORD 101', '101', etc.)
   */
  public static normalizeOrderId(rawId: string): string {
    if (!rawId) return '';
    const cleaned = rawId.trim().toUpperCase().replace(/\s+/g, '-');
    if (/^\d{3}$/.test(cleaned)) {
      return `ORD-${cleaned}`;
    }
    if (/^ORD\d{3}$/.test(cleaned)) {
      return `ORD-${cleaned.slice(3)}`;
    }
    return cleaned;
  }

  /**
   * Retrieves an order by ID
   */
  public static getOrderById(orderId: string): Order | null {
    const normalizedId = this.normalizeOrderId(orderId);
    return MOCK_ORDERS[normalizedId] || null;
  }

  /**
   * Returns all available mock orders (used for test helper)
   */
  public static getAllOrders(): Order[] {
    return Object.values(MOCK_ORDERS);
  }
}
