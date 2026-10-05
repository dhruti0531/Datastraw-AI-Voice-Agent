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

import { DemoService } from './demoService.js';

export class AIService {
  public static isDemoFallbackActive = false;

  private static getClient(customApiKey?: string): OpenAI | null {
    const apiKey = customApiKey || CONFIG.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY_HERE') {
      return null;
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

    // If no API key configured or fallback active, use deterministic DemoService with real tool calls
    if (!openai) {
      this.isDemoFallbackActive = true;
      return DemoService.processChatTurn(conversationHistory, userMessage);
    }

    try {

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
  } catch (error: any) {
    console.warn('OpenAI Chat API unavailable or quota exceeded (429). Falling back to Demo Mode:', error.message || error);
    this.isDemoFallbackActive = true;
    return DemoService.processChatTurn(conversationHistory, userMessage);
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
    if (!openai) {
      return '';
    }

    try {
      const file = await toFile(audioBuffer, filename);
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en'
      });
      return transcription.text;
    } catch (error: any) {
      console.warn('OpenAI Whisper STT unavailable (429/quota). Falling back to browser speech recognition:', error.message || error);
      this.isDemoFallbackActive = true;
      return '';
    }
  }

  /**
   * Synthesize text to spoken audio buffer
   */
  public static async synthesizeSpeech(
    text: string,
    customApiKey?: string
  ): Promise<Buffer> {
    const openai = this.getClient(customApiKey);
    if (!openai) {
      throw new Error('OpenAI client not available for server TTS; use browser speech synthesis.');
    }

    try {
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: (CONFIG.TTS_VOICE as any) || 'shimmer',
        input: text,
        speed: CONFIG.TTS_SPEED
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      console.warn('OpenAI TTS unavailable (429/quota). Falling back to browser speech synthesis:', error.message || error);
      this.isDemoFallbackActive = true;
      throw new Error('Server TTS unavailable; falling back to browser synthesis');
    }
  }

  /**
   * Generate structured post-call JSON summary conforming strictly to Section 16 requirements
   */
  public static async generateSummary(
    transcript: Array<{ role: string; content: string }>,
    customApiKey?: string
  ): Promise<PostCallSummary> {
    const openai = this.getClient(customApiKey);
    if (!openai) {
      return DemoService.generateSummary(transcript);
    }

    try {
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
      return JSON.parse(content) as PostCallSummary;
    } catch (error: any) {
      console.warn('OpenAI Summary API unavailable (429/quota). Falling back to DemoService summary:', error.message || error);
      this.isDemoFallbackActive = true;
      return DemoService.generateSummary(transcript);
    }
  }
}
