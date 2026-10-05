import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { VoiceControlHero } from './components/VoiceControlHero.tsx';
import { TestOrdersHelper } from './components/TestOrdersHelper.tsx';
import { BrandPoliciesCard } from './components/BrandPoliciesCard.tsx';
import { TranscriptView } from './components/TranscriptView.tsx';
import { PostCallSummaryModal } from './components/PostCallSummaryModal.tsx';
import { ApiKeyModal } from './components/ApiKeyModal.tsx';
import { useVoiceAgent } from './hooks/useVoiceAgent.ts';
import { ApiService } from './services/api.ts';
import { Order } from './types/index.ts';

export const App: React.FC = () => {
  const [customApiKey, setCustomApiKey] = useState<string>(
    localStorage.getItem('aura_openai_key') || ''
  );
  const [hasServerKey, setHasServerKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const {
    state,
    isCallActive,
    isListeningMic,
    messages,
    postCallSummary,
    isSummaryModalOpen,
    setIsSummaryModalOpen,
    errorMessage,
    audioAnalyser,
    startCall,
    endCall,
    executeTextTurn,
    playAudio
  } = useVoiceAgent(customApiKey);

  // Load server health & mock orders on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const health = await ApiService.checkHealth(customApiKey);
        setHasServerKey(health.hasApiKey);
      } catch (e) {
        console.warn('Health check error:', e);
      }

      try {
        const orderList = await ApiService.getOrders();
        setOrders(orderList);
      } catch (e) {
        console.warn('Order fetch error:', e);
      }
    };

    initData();
  }, [customApiKey]);

  const handleSaveApiKey = (newKey: string) => {
    setCustomApiKey(newKey);
    if (newKey) {
      localStorage.setItem('aura_openai_key', newKey);
    } else {
      localStorage.removeItem('aura_openai_key');
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    executeTextTurn(prompt);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        hasServerKey={hasServerKey}
        hasClientKey={!!customApiKey}
      />

      <main className="main-container">
        {/* Left Column: Voice Agent Controller & Policies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <VoiceControlHero
            state={state}
            isCallActive={isCallActive}
            onStartCall={startCall}
            onEndCall={endCall}
            audioAnalyser={audioAnalyser}
            errorMessage={errorMessage}
            isListeningMic={isListeningMic}
          />
          <BrandPoliciesCard onSelectPrompt={handleQuickPrompt} />
        </div>

        {/* Center Column: Live Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <TranscriptView
            messages={messages}
            isCallActive={isCallActive}
            onPlaySpeech={(text) => playAudio(null, text)}
          />
        </div>

        {/* Right Column: Test Orders Helper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <TestOrdersHelper
            orders={orders}
            onSelectPrompt={handleQuickPrompt}
            isCallActive={isCallActive}
          />

          {/* Quick Scenario Runner for Evaluator */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.6rem', color: '#34d399' }}>
              ⚡ Evaluator Quick Test Scenarios
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Test any required scenario with 1 click during call:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <button
                onClick={() => handleQuickPrompt('Where is ORD-101?')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
              >
                1. Order Tracking (ORD-101)
              </button>
              <button
                onClick={() => handleQuickPrompt('Can I cancel ORD-103?')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
              >
                2. Valid Cancellation (ORD-103)
              </button>
              <button
                onClick={() => handleQuickPrompt('Can I cancel ORD-101?')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
              >
                3. Invalid Cancellation (ORD-101)
              </button>
              <button
                onClick={() => handleQuickPrompt('Can I return ORD-102?')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
              >
                4. Return Window Check (ORD-102)
              </button>
              <button
                onClick={() => handleQuickPrompt('Where is ORD-999?')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
              >
                5. Invalid Order (ORD-999)
              </button>
              <button
                onClick={() => handleQuickPrompt('Can you book me a flight to Goa?')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '0.4rem 0.65rem', fontSize: '0.76rem' }}
              >
                6. Out-of-Scope Query (Flight to Goa)
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Post-Call JSON Summary Modal */}
      <PostCallSummaryModal
        summary={postCallSummary}
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onSaveKey={handleSaveApiKey}
        currentKey={customApiKey}
        hasServerKey={hasServerKey}
      />
    </div>
  );
};

export default App;
