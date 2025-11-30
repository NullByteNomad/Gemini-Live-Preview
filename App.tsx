import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, LogEntry } from './types';
import TerminalLog from './components/TerminalLog';
import Visualizer from './components/Visualizer';
import { createPcmBlob, base64ToBytes, decodeAudioData } from './services/audioUtils';

const API_KEY = process.env.API_KEY || '';
const HOST_AUDIO_SAMPLE_RATE = 16000;
const MODEL_AUDIO_SAMPLE_RATE = 24000;

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Transcriptions buffering
  const currentInputTranscription = useRef<string>('');
  const currentOutputTranscription = useRef<string>('');

  const addLog = useCallback((sender: LogEntry['sender'], text: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        sender,
        text,
      },
    ]);
  }, []);

  const connectToGemini = async () => {
    if (!API_KEY) {
      addLog('SYSTEM', 'Error: API_KEY is missing in environment variables.');
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      
      // 1. Setup Audio Context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext({
        sampleRate: MODEL_AUDIO_SAMPLE_RATE,
      });
      audioContextRef.current = audioCtx;
      
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.5;
      setAnalyser(analyserNode);

      // 2. Setup Input
      const inputCtx = new AudioContext({
        sampleRate: HOST_AUDIO_SAMPLE_RATE,
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = inputCtx.createMediaStreamSource(stream);
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      inputProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
        if (!sessionPromiseRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData, HOST_AUDIO_SAMPLE_RATE);
        sessionPromiseRef.current.then((session) => {
           session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      // 3. Initialize Gemini Live Session
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are a helpful AI assistant.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
               currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
               currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userInput = currentInputTranscription.current.trim();
              const modelOutput = currentOutputTranscription.current.trim();

              if (userInput) addLog('USER', userInput);
              if (modelOutput) addLog('AI', modelOutput);

              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBuffer = await decodeAudioData(
                base64ToBytes(base64Audio),
                ctx,
                MODEL_AUDIO_SAMPLE_RATE,
                1
              );

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(analyserNode);
              analyserNode.connect(ctx.destination);
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              activeSourcesRef.current.add(sourceNode);

              sourceNode.onended = () => {
                activeSourcesRef.current.delete(sourceNode);
              };
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(src => {
                try { src.stop(); } catch(e) {}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentOutputTranscription.current = '';
            }
          },
          onclose: () => {
            handleDisconnect();
          },
          onerror: (e) => {
            console.error(e);
            handleDisconnect();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error('Connection failed', error);
      addLog('SYSTEM', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown'}`);
      setConnectionState(ConnectionState.ERROR);
      handleDisconnect();
    }
  };

  const handleDisconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputProcessorRef.current) {
      inputProcessorRef.current.disconnect();
      inputProcessorRef.current = null;
    }
    activeSourcesRef.current.forEach(src => {
      try { src.stop(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try { session.close(); } catch(e) {}
        });
        sessionPromiseRef.current = null;
    }
    setConnectionState(ConnectionState.DISCONNECTED);
    setAnalyser(null);
  }, []);

  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, [handleDisconnect]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Header */}
      <header className="flex-none p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Gemini Live</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400 border border-gray-700">Preview</span>
          </div>
          <div className="text-sm text-gray-500">
             Status: <span className={connectionState === ConnectionState.CONNECTED ? "text-green-400" : "text-gray-400"}>{connectionState}</span>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col max-w-3xl mx-auto w-full">
         <div className="flex-1 overflow-y-auto">
            {logs.length === 0 && connectionState === ConnectionState.DISCONNECTED ? (
               <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                   <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                     <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                     </svg>
                   </div>
                   <p className="text-lg font-medium">Ready to chat</p>
                   <p className="text-sm text-gray-400">Click the microphone to start a conversation</p>
               </div>
            ) : (
               <TerminalLog logs={logs} />
            )}
         </div>
         
         {/* Controls */}
         <div className="flex-none p-6 pb-8">
            <div className="mb-6">
               <Visualizer analyser={analyser} isActive={connectionState === ConnectionState.CONNECTED} />
            </div>
            
            <div className="flex justify-center">
              {connectionState !== ConnectionState.CONNECTED ? (
                <button 
                  onClick={connectToGemini}
                  disabled={connectionState === ConnectionState.CONNECTING}
                  className="group relative flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full hover:bg-gray-200 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  {connectionState === ConnectionState.CONNECTING ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                  <span>{connectionState === ConnectionState.CONNECTING ? 'Connecting...' : 'Start Conversation'}</span>
                </button>
              ) : (
                <button 
                  onClick={handleDisconnect}
                  className="flex items-center gap-3 px-8 py-4 bg-red-500/10 text-red-400 border border-red-500/50 rounded-full hover:bg-red-500/20 transition-all font-medium"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>End Session</span>
                </button>
              )}
            </div>
         </div>
      </main>
    </div>
  );
};

export default App;