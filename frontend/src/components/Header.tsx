import React from 'react';
import { Key, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onOpenKeyModal: () => void;
  hasServerKey: boolean;
  hasClientKey: boolean;
  onOpenPolicyModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenKeyModal,
  hasServerKey,
  hasClientKey
}) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-badge">
          <div className="brand-logo-icon">🌿</div>
          <div>
            <h1 className="brand-title">AURA SKINCARE</h1>
            <p className="brand-subtitle">
              <span>Pure Botanical Science</span>
              <span>•</span>
              <span style={{ color: '#34d399', fontWeight: 500 }}>AI Voice Support • Aria</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.35rem 0.75rem',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '9999px',
              border: '1px solid var(--border-glass)',
              fontSize: '0.78rem',
              color: hasServerKey || hasClientKey ? '#34d399' : '#fbbf24'
            }}
          >
            <ShieldCheck size={14} />
            <span>{hasServerKey ? 'Cloud AI Ready' : hasClientKey ? 'Custom Key Active' : 'Configure API Key'}</span>
          </div>

          <button
            onClick={onOpenKeyModal}
            className="btn btn-outline"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            title="Configure OpenAI API Key"
          >
            <Key size={14} />
            <span>API Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
