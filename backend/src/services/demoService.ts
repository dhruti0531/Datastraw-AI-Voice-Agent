import { OrderService } from './orderService.js';
import { executeGetOrderDetails, OrderToolResult } from '../tools/orderTool.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ToolExecutionRecord, ChatResponse, PostCallSummary } from './aiService.js';

export class DemoService {
  /**
   * Extracts an order ID from text or previous conversation context
   */
  public static extractOrderId(text: string, contextMessages: ChatCompletionMessageParam[] = []): string | null {
    // 1. Explicit ORD-xxx format (e.g., ORD-101, ORD101, ord-101, ORD 101, ORD-999)
    const ordMatch = text.match(/\bORD[-_ ]?(\d{3,4})\b/i) || text.match(/\bORD[-_](\w+)\b/i);
    if (ordMatch) {
      return OrderService.normalizeOrderId(ordMatch[0]);
    }

    // 2. "order 101", "order #101", "#101", or standalone 3-digit number "101"
    const standaloneNumberMatch = text.match(/\b(?:order\s*#?|#\s*)(\d{3})\b/i) || text.match(/^\s*#?(\d{3})\s*$/);
    if (standaloneNumberMatch) {
      return OrderService.normalizeOrderId(standaloneNumberMatch[1]);
    }

    // 3. Pronoun / anaphoric reference (e.g., "cancel it", "return it", "where is it", "isko", "yeh")
    const hasPronounRef = /\b(it|this|that|isko|yeh|iss order|iska)\b/i.test(text);
    if (hasPronounRef && contextMessages.length > 0) {
      // Search backwards through context messages for previously mentioned order ID
      for (let i = contextMessages.length - 1; i >= 0; i--) {
        const msg = contextMessages[i];
        const content = typeof msg.content === 'string' ? msg.content : '';
        const prevMatch = content.match(/\bORD[-_ ]?(\d{3,4})\b/i) || content.match(/\bORD[-_](\w+)\b/i);
        if (prevMatch) {
          return OrderService.normalizeOrderId(prevMatch[0]);
        }
      }
    }

    return null;
  }

  /**
   * Deterministic conversational engine enforcing Aura Skincare brand policies & real tool calls
   */
  public static processChatTurn(
    conversationHistory: ChatCompletionMessageParam[],
    userMessage: string
  ): ChatResponse {
    const rawText = userMessage.trim();
    const lower = rawText.toLowerCase();
    const toolCallsExecuted: ToolExecutionRecord[] = [];
    const messages: ChatCompletionMessageParam[] = [...conversationHistory];

    // Append user message
    messages.push({ role: 'user', content: rawText });

    const orderId = this.extractOrderId(rawText, conversationHistory);

    let reply = '';
    let executedToolResult: OrderToolResult | null = null;

    // Execute real tool call if order ID is present or requested
    if (orderId) {
      executedToolResult = executeGetOrderDetails(orderId);
      toolCallsExecuted.push({
        name: 'get_order_details',
        arguments: { order_id: orderId },
        result: executedToolResult
      });
    }

    // Check if input is Hinglish
    const isHinglish = /\b(mera|meri|mujhe|kaha|kab|karein|karna|kar|aayega|aayi|aaya|denge|batao|batayein|chahiye|hai|kya|hoga|hogi|isko|unopened|milega)\b/i.test(lower);

    // 1. Order Cancellation Intent
    if (/\b(cancel|cancellation|cancelling|cancel karna|karna chahti|karna chahta)\b/i.test(lower)) {
      if (!orderId) {
        reply = isHinglish
          ? "Zaroor! Cancellation eligibility check karne ke liye kripya apna order ID (jaise ORD-101) batayein?"
          : "Sure, I can help with cancellation. Could you please share your order ID so I can check whether it's eligible for cancellation?";
      } else if (!executedToolResult || !executedToolResult.found || !executedToolResult.data) {
        reply = isHinglish
          ? `Mujhe system mein order ${orderId} nahi mila. Kripya apna order number verify karke dubara batayein.`
          : `I couldn't locate an order with ID ${orderId} in our system. Could you please verify the order number?`;
      } else {
        const data = executedToolResult.data;
        if (data.cancellation_eligible) {
          reply = isHinglish
            ? `Aapka order ${orderId} (${data.product}) abhi Processing state mein hai aur cancel ho sakta hai. Maine cancellation initiate kar di hai, aur aapka refund 3 se 5 business days mein credit ho jayega.`
            : `Your order ${orderId} for ${data.customer_name} (${data.product}) is currently in Processing and is eligible for cancellation. I have initiated the cancellation for you, and your refund will be processed within 3 to 5 business days.`;
        } else if (data.status.toLowerCase().includes('delivery') || data.status.toLowerCase().includes('shipped')) {
          reply = isHinglish
            ? `Aura Skincare policy ke anusaar, out for delivery ya shipped orders cancel nahi ho sakte. Order ${orderId} abhi ${data.status} hai. Aap delivery ke samay doorstep par receive karne se mana kar sakte hain.`
            : `According to our policy, orders that are Shipped or Out for Delivery cannot be cancelled directly. Since order ${orderId} is currently ${data.status} with ${data.courier || 'our courier partner'}, you may simply refuse the delivery at your doorstep when it arrives.`;
        } else {
          reply = isHinglish
            ? `Order ${orderId} abhi ${data.status} hai aur policy ke mutabik cancel nahi kiya ja sakta.`
            : `Order ${orderId} is currently marked as ${data.status} and cannot be cancelled per Aura Skincare policy.`;
        }
      }
    }
    // 2. Return & Refund Intent (takes priority over general tracking)
    else if (/\b(return|refund|exchange|money back|damaged|broken|defect|defective|leak|leaking|opened|used|wapas|kharaab|kharab|tuta)\b/i.test(lower)) {
      if (orderId && executedToolResult?.found && executedToolResult.data) {
        const data = executedToolResult.data;
        if (!data.return_eligible) {
          reply = isHinglish
            ? `Aura Skincare policy ke mutabik, return sirf delivery ke 7 dino ke andar unopened products ke liye hota hai. Order ${orderId} 14 din pehle deliver hua tha, isliye ab return window se bahar hai.`
            : `Per Aura Skincare policy, returns are accepted strictly within 7 days of delivery for unopened products in original packaging. Since order ${orderId} was delivered 14 days ago, it is unfortunately outside our return window.`;
        } else {
          reply = isHinglish
            ? `Order ${orderId} ke liye return delivery ke 7 din ke andar accepted hai unopened condition mein. Kya main return pickup request initiate karoon?`
            : `Returns for order ${orderId} are accepted within 7 days of delivery for unopened products in original packaging. Would you like me to initiate a return pickup request?`;
        }
      } else if (/\b(damaged|broken|defect|defective|leak|leaking|kharaab|kharab|tuta)\b/i.test(lower)) {
        reply = isHinglish
          ? "Humein khed hai. Damaged ya defective product ke liye kripya delivery ke 48 hours ke andar photos ke saath report karein, hum turant replacement bhej denge."
          : "We are so sorry to hear that! For damaged or defective products, please report the issue within 48 hours of delivery with photos, and we will immediately send a free replacement.";
      } else if (/\b(opened|used|tried|unsealed|khol diya|use kiya)\b/i.test(lower)) {
        reply = isHinglish
          ? "Hamari policy ke anusaar, hum sirf unopened aur unused products hi 7 din ke andar return accept karte hain. Opened products return nahi ho sakte."
          : "Under our return policy, we can only accept returns for unopened, unused products in their original packaging within 7 days of delivery. Opened products cannot be returned.";
      } else if (!orderId) {
        reply = isHinglish
          ? "Zaroor! Return eligibility check karne ke liye kripya apna Aura Skincare order ID batayein?"
          : "Sure, could you please provide your order ID so I can verify your delivery date and return eligibility?";
      } else {
        reply = "Aura Skincare accepts returns within 7 days of delivery for unopened, unused products in their original packaging. Damaged items must be reported within 48 hours with photos for a prompt replacement.";
      }
    }
    // 3. Cash on Delivery (COD) Intent
    else if (/\b(cod|cash on delivery|pay on delivery|upi at doorstep|cash payment)\b/i.test(lower)) {
      reply = isHinglish
        ? "Haan, Cash on Delivery ₹2,500 tak ke orders par available hai. Aap doorstep par cash ya UPI se aasani se pay kar sakte hain."
        : "Yes, Cash on Delivery is available for all orders up to ₹2,500. You can pay conveniently using cash or UPI at your doorstep upon delivery.";
    }
    // 4. Shipping & Delivery Policy Intent
    else if (/\b(shipping|delivery fee|free delivery|delivery charge|delivery charges|shipping fee|shipping cost|how much for delivery|dispatch)\b/i.test(lower)) {
      reply = isHinglish
        ? "₹499 se upar ke sabhi orders par delivery bilkul free hai. ₹499 se kam par flat ₹50 shipping fee lagti hai, aur delivery 3 se 5 business days mein hoti hai."
        : "We offer free delivery across India on all orders above ₹499. For orders below ₹499, a flat ₹50 shipping fee applies. Standard delivery takes 3 to 5 business days.";
    }
    // 5. Out-of-Scope Inquiries
    else if (/\b(flight|hotel|pizza|weather|train|uber|taxi|stock|crypto|movie|joke|song|recipe|doctor|ticket)\b/i.test(lower)) {
      reply = isHinglish
        ? "Main sirf Aura Skincare products, orders, aur brand policies mein help kar sakti hoon. Kya main aapko Aura Skincare ke kisi product ya order ke baare mein bataoon?"
        : "I'm here to help with Aura Skincare orders, deliveries, returns, and related support. I can't help with external requests like flight bookings.";
    }
    // 6. Order Tracking / Delivery Status Intent
    else if (orderId || /\b(where is|track|status|courier|when will|arriving|expected|check order|kaha hai|kab aayega|kab tak|delivery kab)\b/i.test(lower)) {
      if (!orderId) {
        reply = isHinglish
          ? "Zaroor! Main aapke order ka status check kar sakti hoon. Kripya apna Aura Skincare order ID (jaise ORD-101) batayein?"
          : "Sure, I can check that for you. Could you please provide your Aura Skincare order ID (for example, ORD-101)?";
      } else if (!executedToolResult || !executedToolResult.found || !executedToolResult.data) {
        reply = isHinglish
          ? `Mujhe system mein order ${orderId} nahi mila. Kripya apna order number check karke dubara batayein.`
          : `I couldn't locate an order with ID ${orderId} in our system. Could you please verify the number and repeat it?`;
      } else {
        const data = executedToolResult.data;
        if (data.status === 'Out for Delivery') {
          reply = isHinglish
            ? `Aapka order ${orderId} (${data.product}) for ${data.customer_name} out for delivery hai BlueDart (${data.tracking_number}) ke saath, aur aaj shaam 6 baje tak deliver ho jayega!`
            : `Your order ${orderId} containing ${data.product} for ${data.customer_name} is Out for Delivery with ${data.courier} (${data.tracking_number}). It is expected by 6 PM today!`;
        } else if (data.status === 'Delivered') {
          reply = isHinglish
            ? `Aapka order ${orderId} (${data.product}) ${data.customer_name} ke liye 14 din pehle Delhivery (${data.tracking_number}) ke dwara deliver ho chuka hai.`
            : `Order ${orderId} for ${data.customer_name} (${data.product}) was successfully Delivered via ${data.courier} (${data.tracking_number}) 14 days ago.`;
        } else if (data.status === 'Processing') {
          reply = isHinglish
            ? `Aapka order ${orderId} (${data.product}) abhi Processing mein hai. Yeh lagbhag 3 ghante pehle place hua tha aur jaldi hi ship ho jayega.`
            : `Your order ${orderId} containing ${data.product} is currently in Processing. It was ordered approximately 3 hours ago and will ship shortly.`;
        } else {
          reply = `Your order ${orderId} is currently ${data.status}. ${data.delivery_info || ''}`.trim();
        }
      }
    }
    // 7. Brand Overview & Product Inquiries
    else if (/\b(about aura|brand|ingredients|organic|products|serum|sunscreen|facewash|green tea|vitamin c)\b/i.test(lower)) {
      reply = "Aura Skincare is a premium organic Indian skincare brand focused on simple, effective formulations crafted with thoughtfully selected botanical ingredients like Vitamin C and Green Tea.";
    }
    // 8. Greetings & Acknowledgments
    else if (/\b(hi|hello|hey|namaste|good morning|good afternoon|good evening)\b/i.test(lower)) {
      reply = "Namaste! I'm Aria from Aura Skincare. How can I assist you with your skincare routine or order today?";
    } else if (/\b(thank you|thanks|ok|okay|got it|great|awesome|bye|goodbye)\b/i.test(lower)) {
      reply = "You're most welcome! Please let me know if you need anything else. Have a glowing day with Aura Skincare!";
    }
    // 9. Graceful fallback for unclear speech
    else {
      reply = "I'm here to help with Aura Skincare orders, shipping, returns, and brand information. Could you please let me know your question or order number?";
    }

    messages.push({ role: 'assistant', content: reply });

    return {
      reply,
      toolCallsExecuted,
      messages
    };
  }

  /**
   * Deterministic Post-Call Summary generation for Demo Mode
   */
  public static generateSummary(
    transcript: Array<{ role: string; content: string }>
  ): PostCallSummary {
    const fullText = transcript.map((t) => t.content).join(' ');
    const lower = fullText.toLowerCase();

    // Extract order ID
    let orderId: string | null = null;
    const directMatch = fullText.match(/\bORD[- ]?(\d{3})\b/i);
    if (directMatch) {
      orderId = OrderService.normalizeOrderId(directMatch[0]);
    }

    let customerIntent = 'GENERAL_QUERY';
    let policyReferenced: string | null = null;
    let customerName: string | null = null;
    let product: string | null = null;
    let orderStatus: string | null = null;
    const actionsTaken: string[] = [];

    if (orderId) {
      const order = OrderService.getOrderById(orderId);
      if (order) {
        customerName = order.customerName;
        product = order.product;
        orderStatus = order.status;
        actionsTaken.push(`Retrieved live order details for ${orderId} via get_order_details tool`);
      }
    }

    if (/\b(cancel|cancellation)\b/i.test(lower)) {
      customerIntent = 'ORDER_CANCELLATION';
      policyReferenced = 'Orders can only be cancelled while in Processing status';
      if (orderId === 'ORD-101') {
        actionsTaken.push('Informed customer that Out for Delivery order cannot be cancelled directly; advised refusal at doorstep');
      } else if (orderId === 'ORD-103') {
        actionsTaken.push('Initiated cancellation for Processing order and confirmed refund timeline of 3-5 business days');
      }
    } else if (/\b(return|refund|exchange)\b/i.test(lower)) {
      customerIntent = 'RETURN_REQUEST';
      policyReferenced = '7-day return window for unopened products in original packaging';
      if (orderId === 'ORD-102') {
        actionsTaken.push('Informed customer that order delivered 14 days ago exceeds the 7-day return window');
      }
    } else if (orderId || /\b(where is|track|status|delivery|courier)\b/i.test(lower)) {
      customerIntent = 'ORDER_TRACKING';
      if (orderId === 'ORD-101') {
        actionsTaken.push('Informed customer that order is Out for Delivery with BlueDart, expected by 6 PM today');
      } else if (orderId === 'ORD-102') {
        actionsTaken.push('Informed customer that order was Delivered 14 days ago via Delhivery');
      } else if (orderId === 'ORD-103') {
        actionsTaken.push('Informed customer that order is currently in Processing');
      }
    } else if (/\b(shipping|delivery fee|free delivery|cost)\b/i.test(lower)) {
      customerIntent = 'SHIPPING_QUERY';
      policyReferenced = 'Free delivery above ₹499; ₹50 shipping fee below ₹499';
      actionsTaken.push('Explained Aura Skincare shipping thresholds and 3-5 business days delivery timeline');
    } else if (/\b(cod|cash on delivery)\b/i.test(lower)) {
      customerIntent = 'COD_QUERY';
      policyReferenced = 'Cash on Delivery available up to ₹2,500 via cash or UPI';
      actionsTaken.push('Explained Cash on Delivery policy and payment methods at doorstep');
    } else if (/\b(flight|hotel|pizza|weather|train)\b/i.test(lower)) {
      customerIntent = 'OUT_OF_SCOPE';
      actionsTaken.push('Politely redirected out-of-scope inquiry back to Aura Skincare support');
    } else {
      customerIntent = 'GENERAL_QUERY';
      actionsTaken.push('Assisted customer with general Aura Skincare information');
    }

    let summaryText = '';
    if (customerIntent === 'ORDER_TRACKING' && orderId) {
      summaryText = `Customer enquired about the tracking status of ${orderId}. Aria provided real-time status (${orderStatus || 'in transit'}) and courier details.`;
    } else if (customerIntent === 'ORDER_CANCELLATION' && orderId) {
      summaryText = `Customer requested cancellation for ${orderId}. Policy was applied based on status (${orderStatus}), and clear next steps were communicated.`;
    } else if (customerIntent === 'RETURN_REQUEST' && orderId) {
      summaryText = `Customer enquired about returning ${orderId}. Aria verified delivery date and explained the 7-day return policy.`;
    } else {
      summaryText = `Customer spoke with Aria regarding ${customerIntent.toLowerCase().replace('_', ' ')}. Query was addressed adhering strictly to Aura Skincare brand policies.`;
    }

    return {
      customer_intent: customerIntent,
      order_id: orderId,
      customer_name: customerName,
      product: product,
      order_status: orderStatus,
      actions_taken: actionsTaken.length > 0 ? actionsTaken : ['Completed customer support dialogue'],
      policy_referenced: policyReferenced,
      resolution_status: 'RESOLVED',
      unresolved_reason: null,
      call_summary: summaryText
    };
  }
}
