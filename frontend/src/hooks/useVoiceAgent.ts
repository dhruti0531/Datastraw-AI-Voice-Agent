import { useState, useRef, useEffect, useCallback } from 'react';
import { AgentState, Message, PostCallSummary } from '../types/index.js';
import { ApiService } from '../services/api.js';

export function useVoiceAgent(customApiKey?: string) {
  const [state, setState] = useState<AgentState>('idle');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [postCallSummary, setPostCallSummary] = useState<PostCallSummary | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  // Synchronous state refs to prevent stale React closures across multi-turn speech
  const isCallActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isProcessingTurnRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const recognitionInstanceRef = useRef<any>(null);
  const restartTimerRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const sessionBaseTranscriptRef = useRef<string>('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Keep messagesRef in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Format timestamp helper
  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Initialize Audio Context and Analyser
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
        const anal = audioContextRef.current.createAnalyser();
        anal.fftSize = 64;
        setAnalyser(anal);
      }
    }
  }, []);

  // Safe voice resolution: selects best female Indian English browser voice
  const getBestIndianVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // 1. Prioritize female Indian English voices (Heera, Neerja, Raveena, Swara, Aditi, Google)
    const femaleIndianVoice = voices.find(
      (v) =>
        (v.lang.includes('en-IN') || v.lang.includes('en_IN') || v.name.includes('India')) &&
        (v.name.toLowerCase().includes('heera') ||
          v.name.toLowerCase().includes('neerja') ||
          v.name.toLowerCase().includes('raveena') ||
          v.name.toLowerCase().includes('swara') ||
          v.name.toLowerCase().includes('aditi') ||
          v.name.toLowerCase().includes('aria') ||
          v.name.toLowerCase().includes('female'))
    );
    if (femaleIndianVoice) return femaleIndianVoice;

    // 2. Any en-IN voice
    const anyIndianVoice = voices.find(
      (v) => v.lang.includes('en-IN') || v.lang.includes('en_IN') || v.name.includes('India')
    );
    if (anyIndianVoice) return anyIndianVoice;

    // 3. High quality natural female English voice (Jenny, Samantha, Zira)
    const naturalFemaleEnglish = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('jenny') ||
          v.name.toLowerCase().includes('samantha') ||
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('natural'))
    );
    if (naturalFemaleEnglish) return naturalFemaleEnglish;

    // 4. Fallback to any English voice
    return voices.find((v) => v.lang.startsWith('en')) || null;
  }, []);

  // Load and cache browser voices on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const updateVoice = () => {
        const voice = getBestIndianVoice();
        if (voice) setSelectedVoiceName(voice.name);
      };
      updateVoice();
      window.speechSynthesis.onvoiceschanged = updateVoice;
    }
  }, [getBestIndianVoice]);

  // Stop active speech recognition safely
  const stopSpeechRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    accumulatedTranscriptRef.current = '';
    sessionBaseTranscriptRef.current = '';

    if (recognitionInstanceRef.current) {
      try {
        recognitionInstanceRef.current.onresult = null;
        recognitionInstanceRef.current.onend = null;
        recognitionInstanceRef.current.onerror = null;
        recognitionInstanceRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionInstanceRef.current = null;
    }
    setIsListeningMic(false);
  }, []);

  // Forward declaration ref for startListening
  const startListeningRef = useRef<() => void>(() => {});

  // High-Priority Enhancement: Barge-In / Interruption Handler
  const interruptPlayback = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedTranscriptRef.current = '';
    sessionBaseTranscriptRef.current = '';

    if (isSpeakingRef.current) {
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isSpeakingRef.current = false;
      isProcessingTurnRef.current = false;

      if (isCallActiveRef.current) {
        setState('listening');
        setIsListeningMic(true);
        startListeningRef.current();
      }
    }
  }, []);

  // Play audio response using HTML5 Audio or Web Speech fallback
  const playAudio = useCallback(
    async (audioBase64OrBlob: string | Blob | null, textFallback: string) => {
      isSpeakingRef.current = true;
      setState('speaking');

      // Keep SpeechRecognition running in background so customer speech is detected for verbal barge-in
      startListeningRef.current();

      try {
        if (audioBase64OrBlob) {
          let audioUrl: string;
          if (typeof audioBase64OrBlob === 'string') {
            audioUrl = `data:audio/mp3;base64,${audioBase64OrBlob}`;
          } else {
            audioUrl = URL.createObjectURL(audioBase64OrBlob);
          }

          const audio = new Audio(audioUrl);
          currentAudioElementRef.current = audio;

          // Connect audio element to visualizer if AudioContext is active
          if (audioContextRef.current && analyser) {
            try {
              const source = audioContextRef.current.createMediaElementSource(audio);
              source.connect(analyser);
              analyser.connect(audioContextRef.current.destination);
            } catch (e) {
              // Already connected or blocked
            }
          }

          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        } else {
          // Browser SpeechSynthesis fallback with en-IN female voice preference
          await new Promise<void>((resolve) => {
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(textFallback);

              const selectedVoice = getBestIndianVoice();
              if (selectedVoice) {
                utterance.voice = selectedVoice;
                setSelectedVoiceName(selectedVoice.name);
              }
              utterance.rate = 1.2; // Natural, conversational Indian English pace (target 1.2)
              utterance.pitch = 1.0;

              utterance.onend = () => resolve();
              utterance.onerror = () => resolve();

              // Safety timeout in case speech synthesis stalls
              const safetyTimeout = setTimeout(() => resolve(), 15000);
              const originalOnEnd = utterance.onend;
              utterance.onend = (ev) => {
                clearTimeout(safetyTimeout);
                if (originalOnEnd) originalOnEnd.call(utterance, ev);
              };

              window.speechSynthesis.speak(utterance);
            } else {
              resolve();
            }
          });
        }
      } catch (e) {
        console.warn('Audio playback finished with fallback:', e);
      } finally {
        currentAudioElementRef.current = null;
        isSpeakingRef.current = false;
        isProcessingTurnRef.current = false;

        if (isCallActiveRef.current) {
          setState('listening');
          setIsListeningMic(true);
          // Ensure listening loop continues seamlessly
          setTimeout(() => {
            if (isCallActiveRef.current && !isSpeakingRef.current && !isProcessingTurnRef.current) {
              startListeningRef.current();
            }
          }, 100);
        } else {
          setState('idle');
          setIsListeningMic(false);
        }
      }
    },
    [analyser, getBestIndianVoice]
  );

  // Execute a conversation turn with up-to-date message history
  const executeTextTurn = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isProcessingTurnRef.current) return;
      isProcessingTurnRef.current = true;

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      accumulatedTranscriptRef.current = '';
      sessionBaseTranscriptRef.current = '';

      // Barge-in: if Aria was speaking when user spoke, stop playback immediately
      if (isSpeakingRef.current) {
        if (currentAudioElementRef.current) {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current = null;
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        isSpeakingRef.current = false;
      }

      stopSpeechRecognition();
      setErrorMessage(undefined);

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userText.trim(),
        timestamp: getTimestamp()
      };

      // Update messages ref & state with the new user message
      const updatedWithUser = [...messagesRef.current, userMsg];
      messagesRef.current = updatedWithUser;
      setMessages(updatedWithUser);
      setState('thinking');

      try {
        // Build conversation history from updated messagesRef
        const history = updatedWithUser.map((m) => ({
          role: m.role,
          content: m.content
        }));

        const res = await ApiService.sendChat(history, userText, customApiKey);

        if (res.isDemoMode !== undefined) {
          setIsDemoMode(res.isDemoMode);
        }

        const assistantMsg: Message = {
          id: `aria-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          timestamp: getTimestamp(),
          toolCalls: res.toolCallsExecuted
        };

        const updatedWithAssistant = [...messagesRef.current, assistantMsg];
        messagesRef.current = updatedWithAssistant;
        setMessages(updatedWithAssistant);

        // Synthesize audio
        let audioBlob: Blob | null = null;
        try {
          audioBlob = await ApiService.synthesizeSpeech(res.reply, customApiKey);
        } catch (err) {
          // Fallback to client SpeechSynthesis
        }

        await playAudio(audioBlob, res.reply);
      } catch (error: any) {
        console.error('Chat turn error:', error);
        setErrorMessage(error.message || 'Sorry, I had trouble processing that. Please try again.');
        isProcessingTurnRef.current = false;
        if (isCallActiveRef.current) {
          setState('listening');
          setIsListeningMic(true);
          startListeningRef.current();
        }
      }
    },
    [customApiKey, playAudio, stopSpeechRecognition]
  );

  // Create & start SpeechRecognition lifecycle with end-of-speech debounce & verbal barge-in
  const startListening = useCallback(() => {
    if (!isCallActiveRef.current || isProcessingTurnRef.current) {
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    // Do not re-create if already actively listening
    if (recognitionInstanceRef.current) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Continuous listening to avoid cutting off compound phrases
      recognition.interimResults = true; // Capture interim updates with debounce
      recognition.lang = 'en-IN';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (isCallActiveRef.current) {
          setIsListeningMic(true);
          if (!isSpeakingRef.current) {
            setState('listening');
          }
        }
      };

      recognition.onresult = (event: any) => {
        if (!isCallActiveRef.current) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalTranscript += text + ' ';
          } else {
            interimTranscript += text;
          }
        }

        const sessionTranscript = (finalTranscript + interimTranscript).trim();
        const fullTurnText = (
          (sessionBaseTranscriptRef.current ? sessionBaseTranscriptRef.current + ' ' : '') +
          sessionTranscript
        ).trim();

        if (fullTurnText) {
          // Verbal Barge-in: if Aria was speaking, immediately interrupt and stop playback
          if (isSpeakingRef.current) {
            if (currentAudioElementRef.current) {
              currentAudioElementRef.current.pause();
              currentAudioElementRef.current = null;
            }
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            isSpeakingRef.current = false;
            setState('listening');
          }

          accumulatedTranscriptRef.current = fullTurnText;

          // Reset silence debounce timer: wait 950ms after user pauses before submitting
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          silenceTimerRef.current = setTimeout(() => {
            const finalUtterance = accumulatedTranscriptRef.current.trim();
            if (finalUtterance && isCallActiveRef.current && !isProcessingTurnRef.current) {
              accumulatedTranscriptRef.current = '';
              sessionBaseTranscriptRef.current = '';
              stopSpeechRecognition();
              executeTextTurn(finalUtterance);
            }
          }, 950);
        }
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' is a normal timeout when user pauses; onend will smoothly loop back
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition status:', event.error);
        }
      };

      recognition.onend = () => {
        recognitionInstanceRef.current = null;

        // Preserve accumulated speech across browser session restarts if user is still speaking
        if (accumulatedTranscriptRef.current.trim()) {
          sessionBaseTranscriptRef.current = accumulatedTranscriptRef.current.trim();
        }

        // If the call is still active and not processing a turn, keep recognition alive
        if (isCallActiveRef.current && !isProcessingTurnRef.current) {
          restartTimerRef.current = setTimeout(() => {
            if (isCallActiveRef.current && !isProcessingTurnRef.current) {
              startListening();
            }
          }, 100);
        }
      };

      recognitionInstanceRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start error:', err);
      // Retry in 200ms if call is active
      if (isCallActiveRef.current && !isProcessingTurnRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (isCallActiveRef.current) startListening();
        }, 200);
      }
    }
  }, [executeTextTurn, stopSpeechRecognition]);

  // Keep startListeningRef updated
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Start Voice Call
  const startCall = useCallback(async () => {
    setErrorMessage(undefined);
    initAudioContext();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;
      isCallActiveRef.current = true;
      setIsCallActive(true);

      // Connect mic to analyser node for visualizer
      if (audioContextRef.current && analyser) {
        try {
          const micSource = audioContextRef.current.createMediaStreamSource(stream);
          micSource.connect(analyser);
        } catch (e) {
          console.warn('Could not connect mic to analyser:', e);
        }
      }

      // Initial Aria greeting
      const welcomeText = "Namaste! I'm Aria from Aura Skincare. How may I help you with our skincare products or your order today?";
      const initialAriaMsg: Message = {
        id: `aria-welcome-${Date.now()}`,
        role: 'assistant',
        content: welcomeText,
        timestamp: getTimestamp()
      };

      messagesRef.current = [initialAriaMsg];
      setMessages([initialAriaMsg]);

      // Play welcome greeting
      let audioBlob: Blob | null = null;
      try {
        audioBlob = await ApiService.synthesizeSpeech(welcomeText, customApiKey);
      } catch {
        // Fallback to client speech synthesis
      }

      await playAudio(audioBlob, welcomeText);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setState('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Could not initialize microphone. Please check your audio devices.'
      );
    }
  }, [analyser, customApiKey, initAudioContext, playAudio]);

  // End Voice Call & Generate Structured Summary
  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;
    isSpeakingRef.current = false;
    isProcessingTurnRef.current = false;

    setIsCallActive(false);
    setIsListeningMic(false);
    setState('thinking');

    // Stop active speech recognition & timers
    stopSpeechRecognition();

    // Stop all microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop active audio playback
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Generate Post-Call JSON Summary using complete conversation transcript
    try {
      const summary = await ApiService.generateSummary(
        messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
        customApiKey
      );
      setPostCallSummary(summary);
      setIsSummaryModalOpen(true);
      setState('idle');
    } catch (error: any) {
      console.error('Summary generation error:', error);
      setState('idle');
    }
  }, [customApiKey, stopSpeechRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCallActiveRef.current = false;
      stopSpeechRecognition();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopSpeechRecognition]);

  return {
    state,
    isCallActive,
    isListeningMic,
    messages,
    postCallSummary,
    isSummaryModalOpen,
    setIsSummaryModalOpen,
    errorMessage,
    audioAnalyser: analyser,
    isDemoMode,
    selectedVoiceName,
    startCall,
    endCall,
    executeTextTurn,
    interruptPlayback,
    playAudio
  };
}
