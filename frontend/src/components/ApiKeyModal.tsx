import React, { useState } from 'react';
import { Key, Check, X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKey: (key: string) => void;
  currentKey: string;
  hasServerKey: boolean;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSaveKey,
  currentKey,
  hasServerKey
}) => {
  const [keyInput, setKeyInput] = useState(currentKey);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(keyInput.trim());
    onClose();
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
        backdropFilter: 'blur(8px)',
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
          maxWidth: '520px',
          padding: '1.5rem',
          border: '1px solid var(--border-glass)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Key size={20} style={{ color: '#34d399' }} />
            <h3 style={{ fontSize: '1.15rem' }}>OpenAI API Configuration</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {hasServerKey ? (
          <div
            style={{
              padding: '0.85rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: '#a7f3d0',
              marginBottom: '1rem'
            }}
          >
            ✅ Server-side OpenAI API key is detected in backend environment. You do not need to enter a custom key unless you wish to override it.
          </div>
        ) : (
          <div
            style={{
              padding: '0.85rem',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: '#fde68a',
              marginBottom: '1rem'
            }}
          >
            ℹ️ No server-side API key configured. Please enter your OpenAI API key below. It is stored securely in your browser session for this evaluation.
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              OpenAI API Key (sk-...)
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-proj-..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '0.6rem 1rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
              <Check size={16} />
              <span>Save Key</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
