# Implementation Plan: Aura Skincare AI Voice Customer Support Agent ("Aria")

## 1. Architecture Overview
The application is structured as a decoupled, production-grade full-stack web application with clean separation of concerns:

```
[ Customer Browser ]
  │  ▲  (Microphone Audio / Speaker Audio Playback)
  │  │
  │  ▼ (Web Audio API / WebSocket / Audio REST Streams)
[ Backend Gateway (Express.js / Node.js Engine) ]
  ├── Security & Config (Protected Env Vars, Rate Limiting, CORS)
  ├── Voice Pipeline Coordinator:
  │     ├── STT Engine (Whisper / Deepgram / Web Speech Stream)
  │     ├── AI Agent Reasoning (OpenAI GPT-4o / GPT-4o-mini / Groq)
  │     └── TTS Synthesis (Natural Indian English voice profile / ElevenLabs / OpenAI TTS)
  ├── Policy Guardrails & Persona Manager (Aura Skincare rules, Indian CS style)
  ├── Tool Execution Engine:
  │     └── `get_order_details({ order_id })`
  ├── Mock Order Service & Data Store (ORD-101, ORD-102, ORD-103)
  └── Structured Post-Call Summarizer (JSON Schema enforcement)
```

## 2. Technology Stack
- **Frontend**: React 19 + Vite + TypeScript + Modern Vanilla CSS (Glassmorphism, Aura Organic Skincare luxury design system, responsive audio visualizer, live state indicators, test orders helper, real-time transcript log, post-call JSON summary drawer).
- **Backend**: Node.js + Express + TypeScript + `cors` + `dotenv` + `zod` validation.
- **AI & Reasoning**: OpenAI / Groq SDK with Function Calling (`get_order_details`), strict Aura Skincare system prompts and policy guardrails.
- **Voice Pipeline**:
  - Speech-to-Text: OpenAI Whisper API / Groq Whisper / Web Speech API streaming fallback.
  - Text-to-Speech: Natural Indian English voice output (`en-IN` voice synthesis via Edge/ElevenLabs/OpenAI TTS) with smooth Web Audio buffer streaming.
  - Audio Capture: Web Audio API (`AudioContext`, `MediaStreamAudioSourceNode`, `AnalyserNode` for live audio waveform reactivity).
- **Order Data Layer**: Isolated backend service with type-safe schema and query/mutation safety.
- **Deployment**: Vercel (Frontend + Serverless Functions) / Render / Railway / Node Docker container, fully HTTPS-ready.

## 3. Order Data Layer & Tool Architecture
Mock Orders:
- `ORD-101`: Priya Sharma | Vitamin C Serum (30ml) | ₹699 | Status: `Out for Delivery` | BlueDart BD-982103 (Expected by 6 PM today)
- `ORD-102`: Rahul Verma | Hydrating Sunscreen SPF 50 | ₹499 | Status: `Delivered` | Delhivery DL-441029 (Delivered 14 days ago)
- `ORD-103`: Ananya Patel | Green Tea Face Wash + Toner | ₹850 | Status: `Processing` | Ordered 3 hours ago (Eligible for cancellation)

Tool Specification:
```json
{
  "name": "get_order_details",
  "description": "Retrieves the status, shipping, customer, and delivery details for a given Aura Skincare order ID.",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "The order identifier, e.g. ORD-101, ORD-102, ORD-103"
      }
    },
    "required": ["order_id"]
  }
}
```

## 4. Policy Guardrails
1. **Shipping**: Free delivery above ₹499; ₹50 fee below ₹499; 3-5 business days.
2. **Returns & Refunds**: 7-day delivery window; unopened, unused, original packaging; 48h defect reporting with photos.
3. **Cancellation**: Only allowed when status is `Processing`. Shipped / Out for Delivery CANNOT be cancelled (suggest doorstep refusal).
4. **Cash on Delivery**: Available up to ₹2,500; Cash or UPI at doorstep.
5. **Out of Scope**: Refuse non-Aura requests politely (e.g., flight bookings).
6. **No False Promises**: Never guarantee refunds/cancellations outside policy.

## 5. Structured Post-Call Summary
On `End Call`, backend runs structured analysis returning:
```json
{
  "customer_intent": "ORDER_TRACKING" | "ORDER_CANCELLATION" | "RETURN_REQUEST" | "GENERAL_QUERY" | "OUT_OF_SCOPE",
  "order_id": "ORD-101" | null,
  "customer_name": "Priya Sharma" | null,
  "product": "Vitamin C Serum (30ml)" | null,
  "order_status": "Out for Delivery" | null,
  "actions_taken": ["Retrieved order details via tool", "Informed customer of today's delivery"],
  "policy_referenced": "Out for delivery cancellation restriction",
  "resolution_status": "RESOLVED" | "UNRESOLVED" | "ESCALATED",
  "unresolved_reason": null,
  "call_summary": "Customer enquired about ORD-101 delivery..."
}
```
