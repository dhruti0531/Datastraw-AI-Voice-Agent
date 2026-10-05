import { Order, PostCallSummary, ToolExecutionRecord } from '../types/index.js';

// Base API URL can be configured via VITE_API_URL or defaults to relative '/api'
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getHeaders(customApiKey?: string): HeadersInit {
  const headers: Record<string, string> = {};
  const storedKey = customApiKey || localStorage.getItem('aura_openai_key');
  if (storedKey) {
    headers['x-api-key'] = storedKey;
  }
  return headers;
}

export const ApiService = {
  /**
   * Health and capability check
   */
  async checkHealth(customApiKey?: string): Promise<{
    status: string;
    hasApiKey: boolean;
    isDemoMode?: boolean;
    mode?: string;
    model: string;
    voice: string;
  }> {
    const res = await fetch(`${API_BASE}/health`, {
      headers: getHeaders(customApiKey)
    });
    if (!res.ok) throw new Error('Backend health check failed');
    return res.json();
  },

  /**
   * Fetch all mock test orders
   */
  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    const data = await res.json();
    return data.orders || [];
  },

  /**
   * Send multi-turn text chat message
   */
  async sendChat(
    messages: Array<{ role: string; content: string }>,
    userMessage: string,
    customApiKey?: string
  ): Promise<{
    reply: string;
    toolCallsExecuted: ToolExecutionRecord[];
    messages: any[];
    isDemoMode?: boolean;
  }> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(customApiKey)
      },
      body: JSON.stringify({ messages, userMessage })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || 'Failed to send chat message');
    }
    return res.json();
  },

  /**
   * Unified single-roundtrip voice turn: Audio blob -> STT -> Reasoning + Tool -> Spoken TTS Audio
   */
  async sendVoiceTurn(
    audioBlob: Blob,
    messages: Array<{ role: string; content: string }>,
    customApiKey?: string
  ): Promise<{
    userTranscript: string;
    reply: string;
    audioBase64: string | null;
    toolCallsExecuted: ToolExecutionRecord[];
    messages: any[];
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('messages', JSON.stringify(messages));

    const res = await fetch(`${API_BASE}/voice-turn`, {
      method: 'POST',
      headers: getHeaders(customApiKey),
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Voice turn failed' }));
      throw new Error(err.error || 'Failed to process voice turn');
    }
    return res.json();
  },

  /**
   * Text to speech synthesis
   */
  async synthesizeSpeech(text: string, customApiKey?: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(customApiKey)
      },
      body: JSON.stringify({ text })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'TTS failed' }));
      throw new Error(err.error || 'Speech synthesis failed');
    }
    return res.blob();
  },

  /**
   * Generate post-call structured JSON summary
   */
  async generateSummary(
    transcript: Array<{ role: string; content: string }>,
    customApiKey?: string
  ): Promise<PostCallSummary> {
    const res = await fetch(`${API_BASE}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(customApiKey)
      },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Summary generation failed' }));
      throw new Error(err.error || 'Failed to generate post-call summary');
    }
    const data = await res.json();
    return data.summary;
  }
};
