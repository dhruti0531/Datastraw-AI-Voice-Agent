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

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const isProcessingTurnRef = useRef(false);
  const speechRecognitionRef = useRef<any>(null);

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

  // Format timestamp helper
  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Play audio response using HTML5 Audio or Web Speech fallback
  const playAudio = useCallback(async (audioBase64OrBlob: string | Blob | null, textFallback: string) => {
    setState('speaking');

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
            // Context already connected or blocked
          }
        }

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      } else {
        // Resilient SpeechSynthesis fallback with en-IN preferred
        await new Promise<void>((resolve) => {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textFallback);
            
            // Look for Indian English voice
            const voices = window.speechSynthesis.getVoices();
            const indianVoice = voices.find(
              (v) => v.lang.includes('en-IN') || v.name.includes('India') || v.name.includes('Aria')
            ) || voices.find((v) => v.lang.startsWith('en'));

            if (indianVoice) {
              utterance.voice = indianVoice;
            }
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          } else {
            resolve();
          }
        });
      }
    } catch (e) {
      console.warn('Audio playback completed with fallback:', e);
    } finally {
      currentAudioElementRef.current = null;
      if (isCallActive) {
        setState('listening');
      } else {
        setState('idle');
      }
    }
  }, [analyser, isCallActive]);

  // Execute a conversation turn via text or quick test prompt
  const executeTextTurn = useCallback(async (userText: string) => {
    if (!userText.trim() || isProcessingTurnRef.current) return;
    isProcessingTurnRef.current = true;
    setErrorMessage(undefined);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText.trim(),
      timestamp: getTimestamp()
    };

    setMessages((prev) => [...prev, userMsg]);
    setState('thinking');

    try {
      // Build conversation history for API
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await ApiService.sendChat(history, userText, customApiKey);

      const assistantMsg: Message = {
        id: `aria-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: getTimestamp(),
        toolCalls: res.toolCallsExecuted
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Synthesize audio
      let audioBlob: Blob | null = null;
      try {
        audioBlob = await ApiService.synthesizeSpeech(res.reply, customApiKey);
      } catch (err) {
        console.warn('Backend TTS offline, falling back to Web Speech Synthesis', err);
      }

      await playAudio(audioBlob, res.reply);
    } catch (error: any) {
      console.error('Chat turn error:', error);
      setErrorMessage(error.message || 'Error processing request');
      setState('error');
    } finally {
      isProcessingTurnRef.current = false;
    }
  }, [customApiKey, messages, playAudio]);

  // Process recorded audio turn
  const processRecordedAudio = useCallback(async (blob: Blob) => {
    if (isProcessingTurnRef.current || blob.size < 1000) return;
    isProcessingTurnRef.current = true;
    setState('thinking');
    setErrorMessage(undefined);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const result = await ApiService.sendVoiceTurn(blob, history, customApiKey);

      if (result.userTranscript) {
        const userMsg: Message = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: result.userTranscript,
          timestamp: getTimestamp()
        };

        const assistantMsg: Message = {
          id: `aria-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          timestamp: getTimestamp(),
          toolCalls: result.toolCallsExecuted
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        await playAudio(result.audioBase64, result.reply);
      } else {
        setState('listening');
      }
    } catch (error: any) {
      console.error('Voice turn processing error:', error);
      setErrorMessage(error.message || 'Could not understand audio');
      setState('listening');
    } finally {
      isProcessingTurnRef.current = false;
    }
  }, [customApiKey, messages, playAudio]);

  // Start continuous listening with Web Speech API + MediaRecorder
  const startRecordingLoop = useCallback((stream: MediaStream) => {
    setIsListeningMic(true);
    setState('listening');

    // Setup Web Speech Recognition for instant speech detection if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
          const lastIndex = event.results.length - 1;
          const transcript = event.results[lastIndex][0].transcript.trim();
          if (transcript) {
            executeTextTurn(transcript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition warning:', e);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (e) {
        console.warn('Web Speech Recognition unavailable or active:', e);
      }
    }

    // MediaRecorder as high-fidelity audio stream collector
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(500);
    } catch (e) {
      console.warn('MediaRecorder init fallback:', e);
    }
  }, [executeTextTurn]);

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

      setMessages([initialAriaMsg]);

      // Play welcome greeting
      let audioBlob: Blob | null = null;
      try {
        audioBlob = await ApiService.synthesizeSpeech(welcomeText, customApiKey);
      } catch {
        // Fallback to client speech synthesis
      }

      await playAudio(audioBlob, welcomeText);
      startRecordingLoop(stream);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setState('error');
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Could not initialize microphone. Please check your audio devices.'
      );
    }
  }, [analyser, customApiKey, initAudioContext, playAudio, startRecordingLoop]);

  // End Voice Call & Generate Structured Summary
  const endCall = useCallback(async () => {
    setIsCallActive(false);
    setIsListeningMic(false);
    setState('thinking');

    // Stop MediaRecorder and speech recognition
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }

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

    // Generate Post-Call JSON Summary
    try {
      const summary = await ApiService.generateSummary(
        messages.map((m) => ({ role: m.role, content: m.content })),
        customApiKey
      );
      setPostCallSummary(summary);
      setIsSummaryModalOpen(true);
      setState('idle');
    } catch (error: any) {
      console.error('Summary generation error:', error);
      setState('idle');
    }
  }, [customApiKey, messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

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
    startCall,
    endCall,
    executeTextTurn,
    processRecordedAudio,
    playAudio
  };
}
