export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface Order {
  id: string;
  customerName: string;
  product: string;
  value: number;
  currency: string;
  status: 'Processing' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  courier?: string;
  trackingNumber?: string;
  expectedDelivery?: string;
  deliveredAt?: string;
  orderedAt?: string;
  notes: string;
  isEligibleForCancellation: boolean;
  isEligibleForReturn: boolean;
}

export interface ToolExecutionRecord {
  name: string;
  arguments: Record<string, any>;
  result: {
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
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolExecutionRecord[];
}

export interface PostCallSummary {
  customer_intent: string;
  order_id: string | null;
  customer_name: string | null;
  product: string | null;
  order_status: string | null;
  actions_taken: string[];
  policy_referenced: string | null;
  resolution_status: 'RESOLVED' | 'UNRESOLVED' | 'ESCALATED';
  unresolved_reason: string | null;
  call_summary: string;
}
