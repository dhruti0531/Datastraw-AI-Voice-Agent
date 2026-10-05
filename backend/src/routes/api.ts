import { Router, Request, Response } from 'express';
import multer from 'multer';
import { OrderService } from '../services/orderService.js';
import { AIService } from '../services/aiService.js';
import { CONFIG } from '../config/index.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Helper to extract custom API key passed in header if any
function extractApiKey(req: Request): string | undefined {
  const headerKey = req.headers['x-api-key'] as string | undefined;
  return headerKey || undefined;
}

// 1. Health check & configuration status
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Aura Skincare Voice Support Agent (Aria)',
    hasApiKey: !!CONFIG.OPENAI_API_KEY || !!extractApiKey(req),
    model: CONFIG.OPENAI_MODEL,
    voice: CONFIG.TTS_VOICE,
    timestamp: new Date().toISOString()
  });
});

// 2. Test Orders Helper: List all mock orders
router.get('/orders', (req: Request, res: Response) => {
  const orders = OrderService.getAllOrders();
  res.json({ success: true, orders });
});

// 3. Direct Order lookup endpoint
router.get('/orders/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = OrderService.getOrderById(id);
  if (!order) {
    res.status(404).json({ success: false, error: `Order '${id}' not found.` });
    return;
  }
  res.json({ success: true, order });
});

// 4. Multi-turn text chat with function calling
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages = [], userMessage = '' } = req.body;
    const customApiKey = extractApiKey(req);

    const result = await AIService.chat(messages, userMessage, customApiKey);
    res.json({
      success: true,
      reply: result.reply,
      toolCallsExecuted: result.toolCallsExecuted,
      messages: result.messages
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat message.'
    });
  }
});

// 5. Speech to Text (STT) via Whisper
router.post('/stt', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ success: false, error: 'No audio file provided.' });
      return;
    }

    const customApiKey = extractApiKey(req);
    const transcript = await AIService.transcribeAudio(
      req.file.buffer,
      req.file.originalname || 'recording.webm',
      customApiKey
    );

    res.json({ success: true, transcript });
  } catch (error: any) {
    console.error('STT error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio.'
    });
  }
});

// 6. Text to Speech (TTS)
router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: 'Valid text is required.' });
      return;
    }

    const customApiKey = extractApiKey(req);
    const audioBuffer = await AIService.synthesizeSpeech(text, customApiKey);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to synthesize speech.'
    });
  }
});

// 7. Full Unified Voice Turn (Audio in -> STT -> Reasoning/Tool -> TTS audio out + metadata)
router.post('/voice-turn', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ success: false, error: 'No audio file provided.' });
      return;
    }

    const rawHistory = req.body.messages;
    const conversationHistory = rawHistory ? JSON.parse(rawHistory) : [];
    const customApiKey = extractApiKey(req);

    // Step 1: STT
    const transcript = await AIService.transcribeAudio(
      req.file.buffer,
      req.file.originalname || 'audio.webm',
      customApiKey
    );

    if (!transcript.trim()) {
      res.json({
        success: true,
        userTranscript: '',
        reply: "I couldn't hear you clearly. Could you please repeat that?",
        audioBase64: null,
        toolCallsExecuted: [],
        messages: conversationHistory
      });
      return;
    }

    // Step 2: LLM Reasoning + Tool Execution
    const chatResult = await AIService.chat(conversationHistory, transcript, customApiKey);

    // Step 3: TTS Synthesis
    const audioBuffer = await AIService.synthesizeSpeech(chatResult.reply, customApiKey);
    const audioBase64 = audioBuffer.toString('base64');

    res.json({
      success: true,
      userTranscript: transcript,
      reply: chatResult.reply,
      audioBase64: audioBase64,
      toolCallsExecuted: chatResult.toolCallsExecuted,
      messages: chatResult.messages
    });
  } catch (error: any) {
    console.error('Voice turn error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process voice turn.'
    });
  }
});

// 8. Post-call JSON Summarizer
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { transcript = [] } = req.body;
    if (!Array.isArray(transcript) || transcript.length === 0) {
      res.json({
        success: true,
        summary: {
          customer_intent: 'GENERAL_QUERY',
          order_id: null,
          customer_name: null,
          product: null,
          order_status: null,
          actions_taken: ['Call ended with no interaction'],
          policy_referenced: null,
          resolution_status: 'RESOLVED',
          unresolved_reason: null,
          call_summary: 'Customer connected but did not converse.'
        }
      });
      return;
    }

    const customApiKey = extractApiKey(req);
    const summary = await AIService.generateSummary(transcript, customApiKey);

    res.json({ success: true, summary });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate call summary.'
    });
  }
});

export default router;
