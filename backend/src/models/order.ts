export type OrderStatus = 'Processing' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  customerName: string;
  product: string;
  value: number; // in INR (₹)
  currency: string;
  status: OrderStatus;
  courier?: string;
  trackingNumber?: string;
  expectedDelivery?: string;
  deliveredAt?: string;
  orderedAt?: string;
  notes: string;
  isEligibleForCancellation: boolean;
  isEligibleForReturn: boolean;
}
