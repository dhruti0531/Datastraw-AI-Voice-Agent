import React, { useState } from 'react';
import { FileText, Copy, Check, X } from 'lucide-react';
import { PostCallSummary } from '../types/index.js';

interface PostCallSummaryModalProps {
  summary: PostCallSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PostCallSummaryModal: React.FC<PostCallSummaryModalProps> = ({
  summary,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !summary) return null;

  const jsonString = JSON.stringify(summary, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={20} style={{ color: '#34d399' }} />
            <h3 style={{ fontSize: '1.15rem' }}>Post-Call Structured JSON Summary</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Visual Highlight Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Intent</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#34d399', marginTop: '0.2rem' }}>
                {summary.customer_intent}
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resolution Status</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: summary.resolution_status === 'RESOLVED' ? '#34d399' : '#fbbf24', marginTop: '0.2rem' }}>
                {summary.resolution_status}
              </div>
            </div>

            {summary.order_id && (
              <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Order Identified</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>
                  {summary.order_id} {summary.customer_name ? `(${summary.customer_name})` : ''}
                </div>
              </div>
            )}

            {summary.product && (
              <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product & Status</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f3f4f6', marginTop: '0.2rem' }}>
                  {summary.product} • {summary.order_status}
                </div>
              </div>
            )}
          </div>

          {/* Call Summary Text */}
          <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: '#a7f3d0', fontWeight: 600, marginBottom: '0.3rem' }}>EXECUTIVE SUMMARY:</div>
            <p style={{ fontSize: '0.88rem', color: '#f3f4f6', lineHeight: 1.45 }}>{summary.call_summary}</p>
          </div>

          {/* Raw JSON viewer */}
          <div className="summary-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Structured JSON Output:</span>
              <button
                onClick={handleCopy}
                className="btn btn-outline"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="json-code">{jsonString}</pre>
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}
        >
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            Done / Close Summary
          </button>
        </div>
      </div>
    </div>
  );
};
