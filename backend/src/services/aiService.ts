import OpenAI from 'openai';
import { CONFIG } from '../config/index.js';
import { ARIA_SYSTEM_PROMPT } from '../prompts/ariaPersona.js';
import { getOrderDetailsToolDefinition, executeGetOrderDetails, OrderToolResult } from '../tools/orderTool.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { toFile } from 'openai/uploads';

export interface ToolExecutionRecord {
  name: string;
  arguments: Record<string, any>;
  result: OrderToolResult;
}

export interface ChatResponse {
  reply: string;
  toolCallsExecuted: ToolExecutionRecord[];
  messages: ChatCompletionMessageParam[];
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

export class AIService {
  private static getClient(customApiKey?: string): OpenAI {
    const apiKey = customApiKey || CONFIG.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API Key is missing. Please configure OPENAI_API_KEY in .env or provide it in request.');
    }
    return new OpenAI({ apiKey });
  }

  /**
   * Handles a multi-turn conversation turn with Aria including real tool calling
   */
  public static async chat(
    conversationHistory: ChatCompletionMessageParam[],
    userMessage: string,
    customApiKey?: string
  ): Promise<ChatResponse> {
    const openai = this.getClient(customApiKey);

    // Prepare message history with System prompt if not present
    const messages: ChatCompletionMessageParam[] = [];
    
    // Ensure System prompt is at the root
    messages.push({
      role: 'system',
      content: ARIA_SYSTEM_PROMPT
    });

    // Append prior conversation history (excluding any previous root system messages)
    for (const msg of conversationHistory) {
      if (msg.role !== 'system') {
        messages.push(msg);
      }
    }

    // Append the new user turn
    if (userMessage.trim()) {
      messages.push({
        role: 'user',
        content: userMessage.trim()
      });
    }

    const toolCallsExecuted: ToolExecutionRecord[] = [];

    // First LLM call with tool definitions
    const completion = await openai.chat.completions.create({
      model: CONFIG.OPENAI_MODEL,
      messages: messages,
      tools: [getOrderDetailsToolDefinition],
      tool_choice: 'auto',
      temperature: 0.3
    });

    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      throw new Error('No response returned by AI model.');
    }

    // Check if the AI wants to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Append assistant's tool-call request message to conversation
      messages.push(responseMessage);

      // Execute each tool call
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'get_order_details') {
          let parsedArgs: { order_id?: string } = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            parsedArgs = { order_id: toolCall.function.arguments };
          }

          const orderId = parsedArgs.order_id || '';
          const result = executeGetOrderDetails(orderId);

          toolCallsExecuted.push({
            name: toolCall.function.name,
            arguments: parsedArgs,
            result: result
          });

          // Append tool result message
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      }

      // Second LLM call to get natural conversational answer based on real tool output
      const secondCompletion = await openai.chat.completions.create({
        model: CONFIG.OPENAI_MODEL,
        messages: messages,
        temperature: 0.3
      });

      const finalReply = secondCompletion.choices[0]?.message?.content || 'I have checked that for you.';
      messages.push({
        role: 'assistant',
        content: finalReply
      });

      return {
        reply: finalReply,
        toolCallsExecuted,
        messages
      };
    } else {
      // No tool calls needed, directly return assistant answer
      const reply = responseMessage.content || 'How can I assist you with Aura Skincare today?';
      messages.push({
        role: 'assistant',
        content: reply
      });

      return {
        reply,
        toolCallsExecuted,
        messages
      };
    }
  }

  /**
   * Transcribe user audio speech to text using Whisper
   */
  public static async transcribeAudio(
    audioBuffer: Buffer,
    filename = 'audio.webm',
    customApiKey?: string
  ): Promise<string> {
    const openai = this.getClient(customApiKey);
    const file = await toFile(audioBuffer, filename);

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en'
    });

    return transcription.text;
  }

  /**
   * Synthesize text to spoken audio buffer
   */
  public static async synthesizeSpeech(
    text: string,
    customApiKey?: string
  ): Promise<Buffer> {
    const openai = this.getClient(customApiKey);

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: (CONFIG.TTS_VOICE as any) || 'shimmer',
      input: text,
      speed: CONFIG.TTS_SPEED
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generate structured post-call JSON summary conforming strictly to Section 16 requirements
   */
  public static async generateSummary(
    transcript: Array<{ role: string; content: string }>,
    customApiKey?: string
  ): Promise<PostCallSummary> {
    const openai = this.getClient(customApiKey);

    const transcriptText = transcript
      .map((t) => `${t.role === 'user' ? 'Customer' : 'Aria'}: ${t.content}`)
      .join('\n');

    const prompt = `You are the QA and Analytics engine for Aura Skincare customer support calls.
Analyze the following transcript of a customer conversation with Aria and produce a structured JSON summary.

TRANSCRIPT:
${transcriptText}

You must return a valid JSON object matching this schema strictly:
{
  "customer_intent": "ORDER_TRACKING" | "ORDER_CANCELLATION" | "RETURN_REQUEST" | "SHIPPING_QUERY" | "COD_QUERY" | "OUT_OF_SCOPE" | "GENERAL_QUERY",
  "order_id": "ORD-101" or string or null,
  "customer_name": string or null,
  "product": string or null,
  "order_status": string or null,
  "actions_taken": ["string", "string"],
  "policy_referenced": string or null,
  "resolution_status": "RESOLVED" | "UNRESOLVED" | "ESCALATED",
  "unresolved_reason": string or null,
  "call_summary": "Concise 1-3 sentence summary of what was discussed and the outcome."
}

Do not hallucinate or invent fake order numbers. Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: CONFIG.OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert CRM analysis system that outputs strictly valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '{}';
    try {
      return JSON.parse(content) as PostCallSummary;
    } catch {
      return {
        customer_intent: 'GENERAL_QUERY',
        order_id: null,
        customer_name: null,
        product: null,
        order_status: null,
        actions_taken: ['Conversation completed'],
        policy_referenced: null,
        resolution_status: 'RESOLVED',
        unresolved_reason: null,
        call_summary: 'Call completed successfully.'
      };
    }
  }
}
