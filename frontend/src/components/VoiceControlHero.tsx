import React, { useEffect, useRef } from 'react';
import { PhoneCall, PhoneOff, Mic, Loader2, Volume2, AlertCircle, Hand } from 'lucide-react';
import { AgentState } from '../types/index.js';

interface VoiceControlHeroProps {
  state: AgentState;
  isCallActive: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  audioAnalyser: AnalyserNode | null;
  errorMessage?: string;
  isListeningMic: boolean;
  onInterrupt?: () => void;
  selectedVoiceName?: string;
}

export const VoiceControlHero: React.FC<VoiceControlHeroProps> = ({
  state,
  isCallActive,
  onStartCall,
  onEndCall,
  audioAnalyser,
  errorMessage,
  isListeningMic,
  onInterrupt,
  selectedVoiceName
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time canvas waveform visualizer
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = audioAnalyser ? audioAnalyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (audioAnalyser && (state === 'listening' || state === 'speaking')) {
        audioAnalyser.getByteFrequencyData(dataArray);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          if (state === 'speaking') {
            gradient.addColorStop(0, '#0284c7');
            gradient.addColorStop(1, '#38bdf8');
          } else {
            gradient.addColorStop(0, '#059669');
            gradient.addColorStop(1, '#34d399');
          }

          ctx.fillStyle = gradient;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      } else {
        // Idle gentle wave animation
        const time = Date.now() * 0.003;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        for (let x = 0; x < canvas.width; x++) {
          const y = canvas.height / 2 + Math.sin(x * 0.05 + time) * 3;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [audioAnalyser, state]);

  // Render State Badge
  const renderStateBadge = () => {
    switch (state) {
      case 'listening':
        return (
          <div className="state-badge listening">
            <Mic size={14} className="pulse-mic" />
            <span>Listening to you...</span>
          </div>
        );
      case 'thinking':
        return (
          <div className="state-badge thinking">
            <Loader2 size={14} className="spin" />
            <span>Aria is thinking...</span>
          </div>
        );
      case 'speaking':
        return (
          <div className="state-badge speaking">
            <Volume2 size={14} />
            <span>Aria is speaking...</span>
          </div>
        );
      case 'error':
        return (
          <div className="state-badge error">
            <AlertCircle size={14} />
            <span>Notice</span>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="state-badge idle">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af' }}></span>
            <span>{isCallActive ? 'Call Connected • Ready to talk' : 'Ready to talk'}</span>
          </div>
        );
    }
  };

  return (
    <div className="glass-panel voice-hero-card">
      {/* Aria Avatar with active pulse ring */}
      <div className="aria-avatar-wrapper">
        <div className={`pulse-ring ${state === 'listening' || state === 'speaking' ? 'active' : ''}`}></div>
        <img
          src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&auto=format&fit=crop&q=80"
          alt="Aria - Aura Skincare Support Specialist"
          className="aria-avatar-img"
        />
      </div>

      <h2 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>Aria</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Aura Skincare Support Specialist • Indian English Voice
      </p>

      {/* State Badge */}
      {renderStateBadge()}

      {/* Error / Notice message alert if any */}
      {errorMessage && (
        <div
          style={{
            padding: '0.65rem 0.9rem',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#fecdd3',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            width: '100%',
            textAlign: 'left'
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Real-time Audio Waveform Canvas */}
      <canvas ref={canvasRef} width={280} height={50} className="visualizer-canvas" />

      {/* Main Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
        {!isCallActive ? (
          <button
            onClick={onStartCall}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem 1.5rem', fontWeight: 600 }}
            id="start-call-btn"
          >
            <PhoneCall size={18} />
            <span>Start Voice Call</span>
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              {state === 'speaking' && onInterrupt && (
                <button
                  onClick={onInterrupt}
                  className="btn btn-outline"
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: 'rgba(56, 189, 248, 0.12)',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                  title="Interrupt Aria (Barge-in)"
                >
                  <Hand size={16} />
                  <span>Interrupt Aria</span>
                </button>
              )}
              <button
                onClick={onEndCall}
                className="btn btn-danger"
                style={{ flex: 1, padding: '0.75rem 1rem' }}
                id="end-call-btn"
              >
                <PhoneOff size={18} />
                <span>End Call & Summary</span>
              </button>
            </div>
          </>
        )}
      </div>

      {isCallActive && (
        <div style={{ marginTop: '0.85rem', fontSize: '0.76rem', color: 'var(--text-dim)' }}>
          {isListeningMic ? (
            <span style={{ color: '#34d399' }}>🎙️ Microphone active. Speak naturally or in Hinglish.</span>
          ) : state === 'speaking' ? (
            <span style={{ color: '#38bdf8' }}>🔊 Aria is speaking. You can speak or tap Interrupt anytime.</span>
          ) : (
            <span>Processing your request...</span>
          )}
        </div>
      )}

      {selectedVoiceName && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
          Voice: {selectedVoiceName}
        </div>
      )}
    </div>
  );
};
