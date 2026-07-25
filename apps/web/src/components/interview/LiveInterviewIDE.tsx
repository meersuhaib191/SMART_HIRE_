"use client";

import * as React from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PhoneOff,
  Radio,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
  FileText
} from "lucide-react";
import { InterviewTranscriptTurn } from "@/services/ai/live-interview-service";

interface LiveInterviewIDEProps {
  ephemeralToken: string;
  remainingSeconds: number;
  durationMinutes: number;
  assessmentTitle: string;
  candidateName: string;
  jobTitle: string;
  systemPrompt: string;
  onFinish: (transcript: InterviewTranscriptTurn[], timeSpentSeconds: number) => Promise<void>;
}

export function LiveInterviewIDE({
  ephemeralToken,
  remainingSeconds: initialRemainingSeconds,
  durationMinutes,
  assessmentTitle,
  candidateName,
  jobTitle,
  systemPrompt,
  onFinish,
}: LiveInterviewIDEProps) {
  const [remainingSeconds, setRemainingSeconds] = React.useState(initialRemainingSeconds);
  const [status, setStatus] = React.useState<"initializing" | "connected" | "speaking" | "listening" | "reconnecting" | "submitting" | "error">("initializing");
  const [micMuted, setMicMuted] = React.useState(false);
  const [speakerMuted, setSpeakerMuted] = React.useState(false);
  const [showEndModal, setShowEndModal] = React.useState(false);

  const [transcript, setTranscript] = React.useState<InterviewTranscriptTurn[]>([]);
  const [currentAiText, setCurrentAiText] = React.useState("");
  const [currentCandidateText, setCurrentCandidateText] = React.useState("");

  const wsRef = React.useRef<WebSocket | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const startTimeRef = React.useRef(Date.now());
  const transcriptScrollRef = React.useRef<HTMLDivElement | null>(null);

  // ── 1. Authoritative Countdown Timer ────────────────────────────────────────
  React.useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll transcript to bottom
  React.useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript, currentAiText, currentCandidateText]);

  // Format time remaining
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getElapsedFormatted = () => {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
    const m = Math.floor(elapsedSecs / 60);
    const s = elapsedSecs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ── 2. Gemini Live WebSocket Connection & Audio Streaming ───────────────────
  React.useEffect(() => {
    let active = true;

    const initLiveSession = async () => {
      try {
        setStatus("initializing");

        // Initialize WebAudio AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass({ sampleRate: 16000 });

        // Request Microphone Access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
          },
        });
        mediaStreamRef.current = stream;

        // Establish WebSocket connection to Gemini Live API
        // Uses v1alpha BidiLive API with Ephemeral Token / API Key
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${ephemeralToken}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setStatus("connected");

          // Send Setup Configuration Message with System Prompt
          const setupMessage = {
            setup: {
              model: "models/gemini-2.0-flash-exp",
              generationConfig: {
                responseModalities: ["AUDIO", "TEXT"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: "Aoede", // Warm, professional interviewer voice
                    },
                  },
                },
              },
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
            },
          };
          ws.send(JSON.stringify(setupMessage));

          // Start Microphone Audio Processor
          startMicProcessor(stream, ws);
        };

        ws.onmessage = async (event) => {
          if (!active) return;
          try {
            let msgText = event.data;
            if (msgText instanceof Blob) {
              msgText = await msgText.text();
            }
            const data = JSON.parse(msgText);

            // Server Content (Audio / Text Output from Gemini)
            if (data.serverContent?.modelTurn?.parts) {
              for (const part of data.serverContent.modelTurn.parts) {
                // Inline Audio Output
                if (part.inlineData?.mimeType?.startsWith("audio/") && part.inlineData?.data) {
                  setStatus("speaking");
                  if (!speakerMuted) {
                    playAudioChunk(part.inlineData.data);
                  }
                }
                // Text Output Transcript
                if (part.text) {
                  setCurrentAiText((prev) => prev + part.text);
                }
              }
            }

            // Turn Complete -> Commit turn to transcript array
            if (data.serverContent?.turnComplete) {
              setStatus("listening");
              setCurrentAiText((fullText) => {
                if (fullText.trim().length > 0) {
                  setTranscript((prev) => [
                    ...prev,
                    {
                      speaker: "interviewer",
                      text: fullText.trim(),
                      timestampMs: Date.now() - startTimeRef.current,
                      timeFormatted: getElapsedFormatted(),
                    },
                  ]);
                }
                return "";
              });
            }
          } catch (err) {
            console.error("Error parsing Gemini WebSocket message", err);
          }
        };

        ws.onerror = () => {
          if (!active) return;
          setStatus("reconnecting");
        };

        ws.onclose = () => {
          if (!active) return;
          setStatus("reconnecting");
        };
      } catch (err) {
        console.error("Failed to initialize Gemini Live session", err);
        setStatus("error");
      }
    };

    initLiveSession();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [ephemeralToken, systemPrompt, speakerMuted]);

  // Audio Processor for PCM Audio Capture
  const startMicProcessor = (stream: MediaStream, ws: WebSocket) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || micMuted) return;
      const inputData = e.inputBuffer.getChannelData(0);
      // Convert Float32Array to 16-bit PCM Base64
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const base64Audio = arrayBufferToBase64(pcm16.buffer);

      const audioMessage = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm",
              data: base64Audio,
            },
          ],
        },
      };
      ws.send(JSON.stringify(audioMessage));
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  };

  // Play audio chunk from Base64 PCM/wav
  const playAudioChunk = (base64Data: string) => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const rawBytes = base64ToArrayBuffer(base64Data);
      const int16Array = new Int16Array(rawBytes);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      const buffer = ctx.createBuffer(1, float32Array.length, 24000);
      buffer.getChannelData(0).set(float32Array);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch {}
  };

  const handleFinalSubmit = async () => {
    try {
      setStatus("submitting");
      if (wsRef.current) wsRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());

      // Commit any pending AI text turn
      let finalTranscriptList = [...transcript];
      if (currentAiText.trim()) {
        finalTranscriptList.push({
          speaker: "interviewer",
          text: currentAiText.trim(),
          timestampMs: Date.now() - startTimeRef.current,
          timeFormatted: getElapsedFormatted(),
        });
      }

      const totalTimeSpentSeconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
      await onFinish(finalTranscriptList, totalTimeSpentSeconds);
    } catch (err) {
      console.error("Error submitting interview transcript", err);
    }
  };

  return (
    <div className="flex flex-col h-dvh w-dvw bg-zinc-950 text-white overflow-hidden select-none font-sans p-0 m-0">

      {/* Header Bar */}
      <header className="h-16 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">SmartHire AI Live Interview</span>
            <h1 className="text-sm font-extrabold text-white">{jobTitle}</h1>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
            status === "speaking" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
            status === "listening" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
            status === "reconnecting" ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse" :
            "bg-zinc-800 text-zinc-300 border-zinc-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${status === "speaking" ? "bg-emerald-400 animate-ping" : status === "listening" ? "bg-blue-400" : "bg-amber-400"}`} />
            {status === "speaking" ? "Interviewer Speaking..." : status === "listening" ? "Listening to You..." : status === "reconnecting" ? "Reconnecting..." : "Initializing..."}
          </span>
        </div>

        {/* Timer & End Button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-950 px-3.5 py-1.5 rounded-xl border border-zinc-800 font-mono text-sm font-bold text-amber-400">
            <Clock className="h-4 w-4 text-amber-400" />
            <span>{formatTime(remainingSeconds)} Remaining</span>
          </div>
          <button
            onClick={() => setShowEndModal(true)}
            className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold text-xs px-4 py-2 rounded-xl border border-rose-500/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" /> End & Submit
          </button>
        </div>
      </header>

      {/* Main Split View: Visualizer Left (5/12) & Live Transcript Right (7/12) */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left Side: Avatar & Audio Visualizer */}
        <div className="w-5/12 border-r border-zinc-800 bg-zinc-900/60 flex flex-col items-center justify-center p-8 space-y-8 text-center relative">
          
          {/* Animated AI Interviewer Orb */}
          <div className="relative">
            <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border-4 ${
              status === "speaking"
                ? "bg-gradient-to-tr from-blue-600 to-emerald-400 border-emerald-400 scale-105 shadow-emerald-500/30"
                : status === "listening"
                ? "bg-gradient-to-tr from-zinc-800 to-blue-900 border-blue-500 shadow-blue-500/20"
                : "bg-zinc-800 border-zinc-700 opacity-60"
            }`}>
              <Sparkles className={`h-16 w-16 text-white ${status === "speaking" ? "animate-spin" : ""}`} />
            </div>

            {/* Glowing Pulse Rings */}
            {status === "speaking" && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
                <div className="absolute -inset-4 rounded-full border border-blue-400 animate-pulse opacity-20" />
              </>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-white">Alex — AI Technical Interviewer</h2>
            <p className="text-xs text-zinc-400 font-medium">SmartHire Senior Technical Assessor</p>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center gap-3 bg-zinc-950 p-2 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setMicMuted(!micMuted)}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                micMuted ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
              title={micMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              onClick={() => setSpeakerMuted(!speakerMuted)}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                speakerMuted ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
              title={speakerMuted ? "Unmute Audio" : "Mute Audio"}
            >
              {speakerMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
            Speak naturally when replying. Your voice responses are processed in real-time.
          </p>
        </div>

        {/* Right Side: Real-Time Dual Transcript */}
        <div className="w-7/12 flex flex-col bg-zinc-950 overflow-hidden">
          <div className="h-10 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between text-xs font-bold text-zinc-400">
            <span className="flex items-center gap-2 text-zinc-200">
              <MessageSquare className="h-4 w-4 text-blue-400" /> Live Interview Transcript
            </span>
            <span className="text-[10px] text-zinc-500 uppercase">{transcript.length} turns recorded</span>
          </div>

          <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs">
            {transcript.length === 0 && !currentAiText && (
              <div className="text-center py-20 text-zinc-600 italic">
                Interview starting... The AI interviewer will introduce itself shortly.
              </div>
            )}

            {/* Historical Turns */}
            {transcript.map((turn, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border space-y-1 ${
                  turn.speaker === "interviewer"
                    ? "bg-blue-950/20 border-blue-500/20 text-zinc-200"
                    : "bg-emerald-950/20 border-emerald-500/20 text-zinc-200 ml-6"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-extrabold uppercase text-[10px] ${turn.speaker === "interviewer" ? "text-blue-400" : "text-emerald-400"}`}>
                    {turn.speaker === "interviewer" ? "Alex (AI Interviewer)" : candidateName}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">[{turn.timeFormatted}]</span>
                </div>
                <p className="leading-relaxed text-sm">{turn.text}</p>
              </div>
            ))}

            {/* Current Active Streaming Turn */}
            {currentAiText && (
              <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/40 text-zinc-100 space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase text-[10px] text-blue-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" /> Alex (AI Interviewer)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">[{getElapsedFormatted()}]</span>
                </div>
                <p className="leading-relaxed text-sm">{currentAiText}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-center space-y-6 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <PhoneOff className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-white">End & Submit AI Interview?</h2>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Your conversational transcript will be submitted for evaluation. You will not be able to re-enter this session.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-3 rounded-xl border border-zinc-700 transition-all cursor-pointer"
              >
                Continue Interview
              </button>
              <button
                onClick={() => { setShowEndModal(false); handleFinalSubmit(); }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer"
              >
                End & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
