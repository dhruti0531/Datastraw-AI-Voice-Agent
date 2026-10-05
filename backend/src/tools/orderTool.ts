import { OrderService } from '../services/orderService.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const getOrderDetailsToolDefinition: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_order_details',
    description: 'Retrieves live order details, status, shipping courier, delivery timeline, and policy eligibility for an Aura Skincare order ID (e.g., ORD-101, ORD-102, ORD-103).',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The Aura Skincare order ID (e.g. ORD-101, ORD-102, ORD-103).'
        }
      },
      required: ['order_id']
    }
  }
};

export interface OrderToolResult {
  found: boolean;
  order_id: string;
  data?: {
    customer_name: string;
    product: string;
    value: string;
    status: string;
    courier?: string;
    tracking_number?: string;
    delivery_info: string;
    notes: string;
    cancellation_eligible: boolean;
    return_eligible: boolean;
  };
  error_message?: string;
}

export function executeGetOrderDetails(orderId: string): OrderToolResult {
  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return {
      found: false,
      order_id: orderId || '',
      error_message: 'Order ID is missing or empty. Please ask the customer to provide a valid order ID.'
    };
  }

  const order = OrderService.getOrderById(orderId);
  if (!order) {
    return {
      found: false,
      order_id: orderId,
      error_message: `Order '${orderId}' was not found in the Aura Skincare system. Please verify the order number with the customer.`
    };
  }

  return {
    found: true,
    order_id: order.id,
    data: {
      customer_name: order.customerName,
      product: order.product,
      value: `₹${order.value}`,
      status: order.status,
      courier: order.courier,
      tracking_number: order.trackingNumber,
      delivery_info: order.expectedDelivery || order.deliveredAt || order.orderedAt || '',
      notes: order.notes,
      cancellation_eligible: order.isEligibleForCancellation,
      return_eligible: order.isEligibleForReturn
    }
  };
}
