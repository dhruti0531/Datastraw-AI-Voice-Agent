import React from 'react';
import { ShieldCheck, Truck, RotateCcw, XCircle, Banknote } from 'lucide-react';

interface BrandPoliciesCardProps {
  onSelectPrompt?: (prompt: string) => void;
}

export const BrandPoliciesCard: React.FC<BrandPoliciesCardProps> = ({ onSelectPrompt }) => {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <ShieldCheck size={18} style={{ color: '#34d399' }} />
        <h3 style={{ fontSize: '1rem' }}>Brand Policies & Guardrails</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.78rem' }}>
        {/* Shipping */}
        <div style={{ padding: '0.65rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 600, marginBottom: '0.2rem' }}>
            <Truck size={14} />
            <span>Shipping Policy</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            • Free delivery on orders above ₹499<br />
            • ₹50 fee for orders below ₹499<br />
            • Delivery time: 3–5 business days
          </p>
          {onSelectPrompt && (
            <button
              onClick={() => onSelectPrompt('Is delivery free for a ₹400 order?')}
              className="btn btn-outline"
              style={{ marginTop: '0.4rem', padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
            >
              Test Shipping Query
            </button>
          )}
        </div>

        {/* Returns */}
        <div style={{ padding: '0.65rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.2rem' }}>
            <RotateCcw size={14} />
            <span>Return & Refund Policy</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            • Accepted within 7 days of delivery<br />
            • Must be unopened & in original packaging<br />
            • Report defect within 48h with photos
          </p>
          {onSelectPrompt && (
            <button
              onClick={() => onSelectPrompt('Can I return an item I bought 20 days ago and opened?')}
              className="btn btn-outline"
              style={{ marginTop: '0.4rem', padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
            >
              Test Return Guardrail
            </button>
          )}
        </div>

        {/* Cancellation */}
        <div style={{ padding: '0.65rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontWeight: 600, marginBottom: '0.2rem' }}>
            <XCircle size={14} />
            <span>Cancellation Policy</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            • Allowed only when status is <strong>Processing</strong><br />
            • Cannot cancel once Shipped / Out for Delivery
          </p>
        </div>

        {/* COD */}
        <div style={{ padding: '0.65rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a78bfa', fontWeight: 600, marginBottom: '0.2rem' }}>
            <Banknote size={14} />
            <span>Cash on Delivery (COD)</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            • Available for orders up to ₹2,500<br />
            • Pay via Cash or UPI at doorstep
          </p>
          {onSelectPrompt && (
            <button
              onClick={() => onSelectPrompt('Do you offer cash on delivery?')}
              className="btn btn-outline"
              style={{ marginTop: '0.4rem', padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
            >
              Test COD Query
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
