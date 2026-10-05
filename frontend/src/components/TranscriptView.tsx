import React, { useEffect, useRef } from 'react';
import { MessageSquare, Wrench, Volume2, User, Bot, CheckCircle2, XCircle } from 'lucide-react';
import { Message } from '../types/index.js';

interface TranscriptViewProps {
  messages: Message[];
  isCallActive: boolean;
  onPlaySpeech?: (text: string) => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  messages,
  isCallActive,
  onPlaySpeech
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="glass-panel transcript-wrapper">
      <div className="transcript-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <MessageSquare size={18} style={{ color: '#34d399' }} />
          <h3 style={{ fontSize: '1.05rem' }}>Live Conversation Transcript</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isCallActive ? '#34d399' : '#6b7280'
            }}
          ></span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {isCallActive ? 'Recording Live' : 'Call Inactive'}
          </span>
        </div>
      </div>

      <div className="transcript-messages">
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-dim)',
              textAlign: 'center',
              padding: '2rem'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎙️</div>
            <p style={{ fontWeight: 500, color: 'var(--text-muted)' }}>No messages yet</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Click <strong>Start Voice Call</strong> and speak to Aria or test queries.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble-row ${msg.role === 'user' ? 'user' : 'aria'}`}
            >
              <div className={`avatar-sm ${msg.role === 'user' ? 'user' : 'aria'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div className={`message-bubble ${msg.role === 'user' ? 'user' : 'aria'}`}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: msg.role === 'user' ? '#a7f3d0' : 'var(--text-muted)',
                    marginBottom: '0.35rem'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {msg.role === 'user' ? 'Customer' : 'Aria (Aura Skincare)'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                {/* Tool call cards if executed */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ marginTop: '0.6rem' }}>
                    {msg.toolCalls.map((tc, idx) => (
                      <div key={idx} className="tool-call-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', color: '#6ee7b7' }}>
                          <Wrench size={13} />
                          <span style={{ fontWeight: 600 }}>Tool Call:</span>
                          <code>{tc.name}(order_id: "{tc.arguments.order_id}")</code>
                        </div>
                        <div style={{ color: '#d1fae5', paddingLeft: '1.1rem' }}>
                          {tc.result.found ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <CheckCircle2 size={12} style={{ color: '#34d399' }} />
                              <span>
                                Found: {tc.result.data?.customer_name} ({tc.result.data?.product}) • Status: <strong>{tc.result.data?.status}</strong>
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#fca5a5' }}>
                              <XCircle size={12} />
                              <span>{tc.result.error_message}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && onPlaySpeech && (
                  <button
                    onClick={() => onPlaySpeech(msg.content)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.72rem',
                      marginTop: '0.4rem'
                    }}
                    title="Replay Voice Audio"
                  >
                    <Volume2 size={12} />
                    <span>Replay Audio</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
