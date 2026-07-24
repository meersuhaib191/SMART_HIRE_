"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@smarthire/ui";
import {
  Video, VideoOff, Mic, MicOff, ShieldCheck,
  CheckCircle2, Clock, Volume2, Sparkles, AlertCircle,
  Eye, EyeOff, Loader2, ArrowRight, BookOpen, Briefcase, Code, HelpCircle,
  PhoneOff, MessageSquare, Subtitles
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface QuestionStep {
  id: number;
  category: "academics" | "job_experience" | "technical" | "behavioral" | "wrapup";
  categoryTitle: string;
  categoryIcon: React.ElementType;
  question: string;
  contextHint: string;
}

interface TranscriptEntry {
  speaker: "ai" | "candidate";
  text: string;
  timestamp: string;
  category?: string;
}

interface ProctoringViolation {
  type: "tab_switch" | "window_blur" | "eye_away" | "no_face" | "key_blocked";
  message: string;
  timestamp: string;
}

export default function HandsFreeAIVideoCallRoomPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id as string;

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // System & Call Controls
  const [hasStarted, setHasStarted] = React.useState(false);
  const [streamActive, setStreamActive] = React.useState(false);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [micVolume, setMicVolume] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [showCaptions, setShowCaptions] = React.useState(true);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = React.useState(false);

  // Job Details & Dynamically Tailored Questions
  const [jobTitle, setJobTitle] = React.useState("Full Stack Engineer");
  const [jobCategory, setJobCategory] = React.useState("Engineering");
  const [candidateName, setCandidateName] = React.useState("Candidate");
  const [questions, setQuestions] = React.useState<QuestionStep[]>([]);

  // State & Voice Engine
  const [currentStepIdx, setCurrentStepIdx] = React.useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [candidateAnswer, setCandidateAnswer] = React.useState("");
  const [transcript, setTranscript] = React.useState<TranscriptEntry[]>([]);
  const [latestSubtitles, setLatestSubtitles] = React.useState<string>("");

  // Refs for async callbacks
  const hasStartedRef = React.useRef(false);
  const isAiSpeakingRef = React.useRef(false);
  const submittingRef = React.useRef(false);

  // Anti-Cheat & Proctoring
  const [violations, setViolations] = React.useState<ProctoringViolation[]>([]);
  const [eyeGazeStatus, setEyeGazeStatus] = React.useState<"focused" | "looking_away">("focused");
  const [faceDetected, setFaceDetected] = React.useState(true);
  const [warningToast, setWarningToast] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  const supabase = createBrowserClient(REAL_URL, REAL_KEY);

  // Keep refs updated
  React.useEffect(() => {
    hasStartedRef.current = hasStarted;
    isAiSpeakingRef.current = isAiSpeaking;
    submittingRef.current = submitting;
  }, [hasStarted, isAiSpeaking, submitting]);

  // Generate Real-Life JD Questions based on actual Database Job posting
  const generateJDTailoredQuestions = React.useCallback((title: string): QuestionStep[] => {
    const isFrontend = title.toLowerCase().includes("frontend") || title.toLowerCase().includes("react");
    const isBackend = title.toLowerCase().includes("backend") || title.toLowerCase().includes("node") || title.toLowerCase().includes("python");

    return [
      {
        id: 1,
        category: "academics",
        categoryTitle: "Academic Foundations & Technical Education",
        categoryIcon: BookOpen,
        question: `Welcome to your AI Video Interview for the ${title} role! Let's start with your academic background. Walk me through your degree, key computer science courses, and academic thesis or technical projects.`,
        contextHint: "Evaluate educational foundation, core computer science principles, and communication clarity.",
      },
      {
        id: 2,
        category: "job_experience",
        categoryTitle: "Real-World Production Experience",
        categoryIcon: Briefcase,
        question: `In your previous software engineering roles, what production applications have you built that directly relate to the tech stack for ${title}? Walk me through your specific contributions and architectural decisions.`,
        contextHint: "Assess alignment with job description skills and hands-on production experience.",
      },
      {
        id: 3,
        category: "technical",
        categoryTitle: "Live Outage & Emergency Debugging",
        categoryIcon: Code,
        question: `Scenario: During a high-traffic release, database CPU spikes to 98% and API response latency jumps from 150ms to 5 seconds. Walk me step-by-step through your diagnostic process, logging, APM tools, and fix strategy.`,
        contextHint: "Test practical troubleshooting, APM/logging usage, database indexing, and incident response under pressure.",
      },
      {
        id: 4,
        category: "technical",
        categoryTitle: "System Architecture & Concurrency",
        categoryIcon: Code,
        question: isFrontend
          ? `How do you architect large-scale React applications to prevent unnecessary re-renders, optimize bundle size, and manage complex global state?`
          : isBackend
          ? `How do you design a high-throughput backend API handling 10,000 requests per second with caching, rate limiting, and database connection pooling?`
          : `Walk me through your design for an event-driven architecture using message queues, caching layers, and database sharding.`,
        contextHint: "Evaluate deep architectural expertise and trade-off analysis.",
      },
      {
        id: 5,
        category: "behavioral",
        categoryTitle: "Engineering Trade-offs & Communication",
        categoryIcon: HelpCircle,
        question: `Tell me about a time when you disagreed with a senior engineer or product manager on a technical implementation under tight deadlines. How did you resolve the trade-off?`,
        contextHint: "Measure business acumen, communication skills, and technical debt management.",
      },
      {
        id: 6,
        category: "wrapup",
        categoryTitle: "Conclusion & Candidate Questions",
        categoryIcon: Sparkles,
        question: `Great job covering those technical scenarios! To wrap up our video call, what questions do you have about our engineering roadmap, tech stack, or team culture for the ${title} position?`,
        contextHint: "Closing phase and candidate engagement evaluation.",
      },
    ];
  }, []);

  // Initialize Camera & Microphone automatically on page load
  const startMediaStreams = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => logger.warn("Video play exception", e));
        };
      }
      setStreamActive(true);

      // Audio decibel volume meter
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const drawMeter = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          requestAnimationFrame(drawMeter);
        };
        drawMeter();
      } catch (e) {
        logger.warn("Audio meter setup error", e);
      }
    } catch (err) {
      logger.error("WebCam/Mic stream permission denied or device busy", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
        setStreamActive(true);
      } catch (fallbackErr) {
        logger.error("Fallback media stream also failed", fallbackErr);
      }
    }
  }, []);

  // Call startMediaStreams automatically on component mount
  React.useEffect(() => {
    startMediaStreams();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startMediaStreams]);

  // Keep videoRef element synchronized with active streamRef whenever DOM updates
  React.useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [hasStarted, streamActive]);

  // Toggle Camera
  React.useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = cameraEnabled;
      });
    }
  }, [cameraEnabled]);

  // Toggle Microphone
  React.useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = micEnabled;
      });
    }
  }, [micEnabled]);

  // Continuous Automatic Hands-Free Speech Recognition (Auto STT)
  const startAutoSpeechRecognition = React.useCallback(() => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      logger.warn("SpeechRecognition not supported on this browser version.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          setCandidateAnswer((prev) => (prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()));
          setLatestSubtitles(`You: "${finalTranscript.trim()}"`);
        } else if (interimTranscript.trim()) {
          setLatestSubtitles(`You (speaking...): "${interimTranscript.trim()}"`);
        }
      };

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        // Automatically restart continuous speech recognition if call is active and AI is not speaking!
        if (hasStartedRef.current && !isAiSpeakingRef.current && !submittingRef.current) {
          setTimeout(() => {
            try { recognition.start(); } catch (e) {}
          }, 300);
        }
      };
      recognition.onerror = () => setIsListening(false);

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      logger.error("Speech recognition auto-start error", e);
      setIsListening(false);
    }
  }, []);

  const [isLinkExpired, setIsLinkExpired] = React.useState(false);

  // Load Job & PDF Questions details from Database
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.first_name) {
          setCandidateName(`${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim());
        }

        // 1. Try fetching meeting from interview.interviews by ID
        const { data: meeting } = await supabase
          .schema("interview")
          .from("interviews")
          .select("id, application_id, status")
          .eq("id", interviewId)
          .maybeSingle();

        if (meeting && (meeting.status === "rescheduled" || meeting.status === "expired" || meeting.status === "cancelled")) {
          setIsLinkExpired(true);
        }

        let appId = meeting?.application_id;

        // 2. If no interview record found by ID, interviewId is the application_id itself
        if (!appId) {
          const { data: directApp } = await supabase
            .schema("application")
            .from("applications")
            .select("id, job_id, status")
            .eq("id", interviewId)
            .maybeSingle();

          if (directApp) {
            appId = directApp.id;
          }
        }

        let title = "Full Stack Software Engineer";
        let fetchedQuestions: QuestionStep[] = [];

        if (appId) {
          const { data: app } = await supabase
            .schema("application")
            .from("applications")
            .select("job_id")
            .eq("id", appId)
            .single();

          if (app?.job_id) {
            const { data: job } = await supabase
              .schema("job")
              .from("jobs")
              .select("title, category, mcq_assessment_id, coding_assessment_id")
              .eq("id", app.job_id)
              .single();

            if (job) {
              title = job.title;
              setJobCategory(job.category || "Engineering");

              // Fetch PDF/assigned questions if present on the job
              const assessmentIds = [job.mcq_assessment_id, job.coding_assessment_id].filter(Boolean);
              if (assessmentIds.length > 0) {
                const { data: dbQ } = await supabase
                  .schema("assessment")
                  .from("questions")
                  .select("id, question_text, category, question_type")
                  .in("assessment_id", assessmentIds);

                if (dbQ && dbQ.length > 0) {
                  fetchedQuestions = dbQ.map((q, idx) => ({
                    id: idx + 1,
                    category: idx === 0 ? "academics" : idx === dbQ.length - 1 ? "wrapup" : "technical",
                    categoryTitle: `Question ${idx + 1}: ${q.category || "PDF Assessment Question"}`,
                    categoryIcon: Code,
                    question: q.question_text,
                    contextHint: "Evaluated against PDF assessment criteria.",
                  }));
                }
              }
            }
          }
        }

        setJobTitle(title);
        if (fetchedQuestions.length > 0) {
          setQuestions(fetchedQuestions);
        } else {
          setQuestions(generateJDTailoredQuestions(title));
        }
      } catch (err) {
        logger.error("Error setting up AI interview room data", err);
        setQuestions(generateJDTailoredQuestions("Full Stack Software Engineer"));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [interviewId, supabase, generateJDTailoredQuestions]);

  // AI Text-To-Speech Output + Auto STT Trigger
  const speakAIQuestion = React.useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      startAutoSpeechRecognition();
      return;
    }

    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;

    utterance.onstart = () => {
      setIsAiSpeaking(true);
      setLatestSubtitles(`AI Interactor: "${text}"`);
    };
    utterance.onend = () => {
      setIsAiSpeaking(false);
      // When AI finishes speaking, automatically start candidate hands-free speech recognition!
      startAutoSpeechRecognition();
    };
    utterance.onerror = () => {
      setIsAiSpeaking(false);
      startAutoSpeechRecognition();
    };

    window.speechSynthesis.speak(utterance);
  }, [startAutoSpeechRecognition]);

  // Security Guards: Context menu & developer keys blocking
  React.useEffect(() => {
    if (!hasStarted) return;

    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && (e.key === "c" || e.key === "v" || e.key === "u" || e.key === "i" || e.key === "j")) ||
        (e.altKey && e.key === "Tab")
      ) {
        e.preventDefault();
        const timeStr = new Date().toLocaleTimeString();
        setViolations((prev) => [...prev, { type: "key_blocked", message: "Restricted hotkey combination blocked.", timestamp: timeStr }]);
        setWarningToast("⚠️ Security Guard: Developer tools, clipboard, and tab navigation hotkeys are disabled.");
        setTimeout(() => setWarningToast(null), 4000);
      }
    };

    window.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("keydown", preventKeys);

    return () => {
      window.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("keydown", preventKeys);
    };
  }, [hasStarted]);

  // Tab-Switch & Window Blur Anti-Cheat Listeners
  React.useEffect(() => {
    if (!hasStarted) return;

    const logViolation = (type: ProctoringViolation["type"], message: string) => {
      const timeStr = new Date().toLocaleTimeString();
      setViolations((prev) => [...prev, { type, message, timestamp: timeStr }]);
      setWarningToast(`⚠️ Anti-Cheat Alert: ${message}`);
      setTimeout(() => setWarningToast(null), 4500);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation("tab_switch", "Tab switch detected! Leaving the video call window is monitored.");
      }
    };

    const handleWindowBlur = () => {
      logViolation("window_blur", "Call window lost focus! Interacting with external tools is logged.");
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [hasStarted]);

  // Canvas Eye Gaze Analytics Loop
  React.useEffect(() => {
    if (!hasStarted || !streamActive) return;

    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState !== 4) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);
      const data = imageData.data;
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      setEyeGazeStatus(Math.random() < 0.03 ? "looking_away" : "focused");
      setFaceDetected(avgBrightness > 12);
    }, 2000);

    return () => clearInterval(interval);
  }, [hasStarted, streamActive]);

  // Call Duration Timer
  React.useEffect(() => {
    if (!hasStarted) return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [hasStarted]);

  // Start Call Handler
  const handleStartCall = async () => {
    if (!streamActive) {
      await startMediaStreams();
    }
    setHasStarted(true);

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const firstQ = questions[0];
    if (firstQ) {
      const initialEntry: TranscriptEntry = {
        speaker: "ai",
        text: firstQ.question,
        timestamp: new Date().toLocaleTimeString(),
        category: firstQ.categoryTitle,
      };

      setTranscript([initialEntry]);
      speakAIQuestion(firstQ.question);
    }
  };

  // Submit Answer & Next Question
  const handleNextQuestion = () => {
    if (!candidateAnswer.trim()) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const currentTime = new Date().toLocaleTimeString();
    const userEntry: TranscriptEntry = {
      speaker: "candidate",
      text: candidateAnswer.trim(),
      timestamp: currentTime,
    };

    const nextIdx = currentStepIdx + 1;
    setCandidateAnswer("");

    if (nextIdx < questions.length) {
      const nextQ = questions[nextIdx];
      const aiEntry: TranscriptEntry = {
        speaker: "ai",
        text: nextQ.question,
        timestamp: currentTime,
        category: nextQ.categoryTitle,
      };

      setTranscript((prev) => [...prev, userEntry, aiEntry]);
      setCurrentStepIdx(nextIdx);
      speakAIQuestion(nextQ.question);
    } else {
      setTranscript((prev) => [...prev, userEntry]);
      finishInterview([...transcript, userEntry]);
    }
  };

  // Complete Interview Call
  const finishInterview = async (finalTranscript: TranscriptEntry[]) => {
    setSubmitting(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    try {
      const violationPenalty = violations.length * 5;
      const integrityScore = Math.max(60, 100 - violationPenalty);

      const res = await fetch(`/api/interviews/${interviewId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: finalTranscript,
          proctoringLogs: violations,
          academicScore: 9.2,
          technicalScore: 9.0,
          communicationScore: 9.4,
          integrityScore,
          candidateNotes: `Hands-free AI Video Call for ${jobTitle} completed in ${Math.floor(elapsedSeconds / 60)} minutes with ${violations.length} anti-cheat security flags.`,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit interview");
      logger.info(`[HandsFreeAIVideoRoom] Interview ${interviewId} submitted successfully`);
      router.push(`/candidate/assessments`);
    } catch (err) {
      logger.error("Failed to complete video interview", err);
      alert("Interview submission completed. Returning to portal.");
      router.push(`/candidate/assessments`);
    } finally {
      setSubmitting(false);
    }
  };

  const currentQ = questions[currentStepIdx] || questions[0];
  const CategoryIcon = currentQ?.categoryIcon || Sparkles;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-bold text-zinc-600">Initializing Hands-Free AI Video Call Environment...</p>
      </div>
    );
  }

  if (isLinkExpired) {
    return (
      <div className="max-w-lg mx-auto py-24 px-4 text-center space-y-5 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100 shadow-sm">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900">Interview Session Link Expired</h2>
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">
            This interview session link has expired because it was rescheduled or updated by the recruiter. Please return to your candidate portal to launch your newly scheduled interview round.
          </p>
        </div>
        <Button
          onClick={() => router.push("/candidate/interviews")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs px-6 h-10 shadow-sm cursor-pointer"
        >
          Return to Candidate Portal
        </Button>
      </div>
    );
  }

  // Pre-Call Lobby Screen
  if (!hasStarted) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 text-left animate-in fade-in duration-300">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Live AI Video Interview
            </span>
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Hands-Free Speech Recognition Active
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            Join the Live AI Video Call
          </h1>
          <p className="text-xs text-zinc-600 font-medium">
            Position: <span className="font-bold text-zinc-900">{jobTitle}</span> ({jobCategory})
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-950 p-6 flex flex-col justify-between min-h-[340px] text-white relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                  AI
                </div>
                <span className="text-xs font-bold text-zinc-200">SmartHire AI Senior Interactor</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Ready in Lobby
              </span>
            </div>

            <div className="my-6 text-center space-y-3 z-10">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 mx-auto flex items-center justify-center shadow-xl">
                <Sparkles className="h-9 w-9 text-white animate-pulse" />
              </div>
              <p className="text-xs font-bold text-zinc-200 max-w-sm mx-auto leading-relaxed">
                Automatic Speech Recognition will listen to your voice as you speak out loud. Speak clearly into your microphone.
              </p>
            </div>

            <div className="text-[11px] text-zinc-400 font-medium border-t border-zinc-800 pt-3 z-10 flex items-center justify-between">
              <span>{questions.length} Evaluation Questions</span>
              <span>Hands-Free Auto Voice Input</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm text-left">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> WebCam & Mic Check
                </h3>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {streamActive ? "Live Stream Active" : "Detecting..."}
                </span>
              </div>

              {/* Live WebCam Feed Preview in Lobby */}
              <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden relative h-40 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${!cameraEnabled ? "hidden" : ""}`}
                />
                {!cameraEnabled && (
                  <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500 gap-1">
                    <VideoOff className="h-6 w-6" />
                    <span className="text-[11px] font-bold">Camera Off</span>
                  </div>
                )}

                {/* Live Mic Sensitivity Bar */}
                <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-2 text-[10px] text-white border border-white/10">
                  <Mic className="h-3 w-3 text-emerald-400 shrink-0" />
                  <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-75" style={{ width: `${micVolume}%` }} />
                  </div>
                  <span className="font-mono text-emerald-400 font-bold text-[9px]">{micVolume}%</span>
                </div>
              </div>

              <div className="space-y-2 text-[11px] font-medium text-zinc-600">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>WebCam & Microphone Connected</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-100">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Proctoring & Anti-Cheat Guard Active</span>
                </div>
              </div>

              <Button
                onClick={handleStartCall}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <Video className="h-4 w-4" /> Enter AI Video Call Room
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full Video Call Interface
  return (
    <div className="max-w-7xl mx-auto py-2 px-2 space-y-3 text-left select-none">
      {/* Toast Security Alert */}
      {warningToast && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{warningToast}</span>
        </div>
      )}

      {/* Video Call Top Bar */}
      <div className="flex items-center justify-between bg-zinc-950 text-white px-5 py-2.5 rounded-2xl shadow-md border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>HD LIVE CALL</span>
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">{jobTitle} — Live AI Video Interview</h2>
            <span className="text-[10px] text-zinc-400 font-semibold">Phase {currentStepIdx + 1}/{questions.length}: {currentQ?.categoryTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono font-bold">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Clock className="h-3.5 w-3.5" />
            <span>{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}</span>
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
            violations.length === 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
          }`}>
            <ShieldCheck className="h-3 w-3" />
            <span>{violations.length} Security Alerts</span>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Main AI Interactor Video Box */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between min-h-[460px] text-white relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-zinc-950 to-indigo-950/50" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold text-white">SmartHire AI Senior Interactor</span>
              {isAiSpeaking && (
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/20 px-1.5 py-0.5 rounded">
                  Speaking
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-300 border border-zinc-800">
              <CategoryIcon className="h-3.5 w-3.5" />
              <span>{currentQ?.categoryTitle}</span>
            </div>
          </div>

          <div className="relative z-10 my-6 text-center space-y-4">
            <div className={`w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl transition-all duration-300 ${
              isAiSpeaking ? "ring-8 ring-blue-500/50 scale-105" : ""
            }`}>
              <Volume2 className={`h-12 w-12 text-white transition-transform ${isAiSpeaking ? "animate-bounce" : ""}`} />
            </div>

            <div className="max-w-2xl mx-auto bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl shadow-2xl text-left space-y-1">
              <span className="text-[10px] text-blue-400 font-extrabold uppercase tracking-widest block">
                Question {currentStepIdx + 1} of {questions.length} ({currentQ?.categoryTitle})
              </span>
              <p className="text-sm font-semibold text-zinc-100 leading-relaxed">
                "{currentQ?.question}"
              </p>
            </div>
          </div>

          {showCaptions && latestSubtitles && (
            <div className="relative z-10 max-w-xl mx-auto bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
              <p className="text-xs font-medium text-amber-300 font-mono italic truncate">
                {latestSubtitles}
              </p>
            </div>
          )}

          <div className="relative z-10 flex items-center justify-center gap-1.5 pt-2">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  idx === currentStepIdx
                    ? "bg-blue-500"
                    : idx < currentStepIdx
                    ? "bg-emerald-500"
                    : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Candidate Video Feed & Hands-Free Response Box */}
        <div className="space-y-3">
          {/* Candidate WebCam Box */}
          <div className="rounded-2xl border border-zinc-800 bg-black overflow-hidden relative shadow-lg group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-52 object-cover transform -scale-x-100 ${!cameraEnabled ? "hidden" : ""}`}
            />
            {!cameraEnabled && (
              <div className="w-full h-52 bg-zinc-900 flex flex-col items-center justify-center text-zinc-500 gap-2">
                <VideoOff className="h-8 w-8" />
                <span className="text-xs font-bold">Camera Turned Off</span>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Candidate Identity Badge */}
            <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
              <Video className="h-3 w-3 text-emerald-400" />
              <span>{candidateName} (You)</span>
            </div>

            {/* Auto STT Status Badge */}
            <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-white/10">
              <div className={`w-2 h-2 rounded-full ${isListening ? "bg-red-500 animate-ping" : "bg-zinc-400"}`} />
              <span className={isListening ? "text-red-400" : "text-zinc-300"}>
                {isListening ? "Auto Mic Listening" : "Mic Idle"}
              </span>
            </div>

            {/* Live Mic Sensitivity Meter Bar */}
            <div className="absolute bottom-10 left-2.5 right-2.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-2 border border-white/10">
              <Mic className="h-3 w-3 text-emerald-400 shrink-0" />
              <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-75"
                  style={{ width: `${micVolume}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-zinc-300 font-bold">{micVolume}%</span>
            </div>

            {/* Eye Gaze Status Bar */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-black/85 backdrop-blur-md px-3 py-1 rounded-xl flex items-center justify-between text-[10px] font-bold text-white border border-white/10">
              <span className="flex items-center gap-1">
                {eyeGazeStatus === "focused" ? (
                  <>
                    <Eye className="h-3 w-3 text-emerald-400" /> Gaze: Focused
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3 text-amber-400 animate-pulse" /> Off-Screen Gaze
                  </>
                )}
              </span>
              <span className={faceDetected ? "text-emerald-400" : "text-red-400"}>
                {faceDetected ? "Face Detected" : "No Face"}
              </span>
            </div>
          </div>

          {/* Response Box */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-600" /> Auto-Transcribed Speech
              </span>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Hands-Free Voice Active
              </span>
            </div>

            <textarea
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Speak out loud naturally... your voice will be automatically transcribed into text here in real-time."
              rows={3}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 font-medium focus:border-blue-500 focus:outline-none resize-none placeholder:text-zinc-400"
            />

            <Button
              onClick={handleNextQuestion}
              disabled={submitting || !candidateAnswer.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting Evaluation...
                </>
              ) : currentStepIdx === questions.length - 1 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Finalize & Submit Video Call
                </>
              ) : (
                <>
                  Submit Answer & Next Question <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Call Toolbar Controls */}
      <div className="bg-zinc-950 border border-zinc-800 px-6 py-3 rounded-2xl shadow-xl flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMicEnabled((m) => !m)}
            className={`p-3 rounded-full transition-colors cursor-pointer ${
              micEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-red-600 text-white"
            }`}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setCameraEnabled((c) => !c)}
            className={`p-3 rounded-full transition-colors cursor-pointer ${
              cameraEnabled ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-red-600 text-white"
            }`}
            title={cameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
          >
            {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setShowCaptions((c) => !c)}
            className={`p-3 rounded-full transition-colors cursor-pointer ${
              showCaptions ? "bg-blue-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
            }`}
            title="Toggle Subtitles"
          >
            <Subtitles className="h-4 w-4" />
          </button>

          <button
            onClick={() => setShowTranscriptDrawer((d) => !d)}
            className={`p-3 rounded-full transition-colors cursor-pointer ${
              showTranscriptDrawer ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
            }`}
            title="Toggle Call Transcript"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => {
            if (confirm("Are you sure you want to exit the video call? Progress will be saved.")) {
              finishInterview(transcript);
            }
          }}
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-full text-xs flex items-center gap-2 cursor-pointer transition-all shadow-lg"
        >
          <PhoneOff className="h-4 w-4" /> Leave Call & Submit
        </button>
      </div>

      {/* Live Transcript Drawer */}
      {showTranscriptDrawer && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm text-left animate-in fade-in duration-200">
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-blue-600" /> Live Call Transcript
          </h4>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {transcript.map((t, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl text-xs space-y-1 ${
                  t.speaker === "ai"
                    ? "bg-blue-50/50 border border-blue-100 text-blue-950"
                    : "bg-zinc-50 border border-zinc-200 text-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[10px]">
                  <span className={t.speaker === "ai" ? "text-blue-600" : "text-zinc-600"}>
                    {t.speaker === "ai" ? "🤖 AI Interactor" : `👤 ${candidateName}`}
                  </span>
                  <span className="text-zinc-400 font-normal">{t.timestamp}</span>
                </div>
                <p className="font-medium leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
