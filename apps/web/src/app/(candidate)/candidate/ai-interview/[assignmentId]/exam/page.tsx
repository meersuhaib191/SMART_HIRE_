"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { InterviewTranscriptTurn, StructuredInterviewEvaluation } from "@/services/ai/live-interview-service";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  Download,
  RotateCcw,
  Send,
  Subtitles,
  MessageSquare,
  PhoneOff
} from "lucide-react";
import { logger } from "@smarthire/logger";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface CompletedResult {
  overallScore: number;
  passed: boolean;
  evaluation: StructuredInterviewEvaluation;
  transcript: InterviewTranscriptTurn[];
  timeSpentSeconds: number;
}

interface ProctoringEvent {
  type: string;
  message: string;
  timestamp: string;
}

export default function CandidateAIInterviewExamPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [resolvedAssignmentId, setResolvedAssignmentId] = React.useState<string>(assignmentId);

  // Pre-interview state
  const [assessmentTitle, setAssessmentTitle] = React.useState("AI Live Technical Interview");
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [jobTitle, setJobTitle] = React.useState("Technical Position");
  const [candidateName, setCandidateName] = React.useState("Candidate");

  // Device check state
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const videoPreviewRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [micActive, setMicActive] = React.useState(false);
  const [micVolume, setMicVolume] = React.useState(0);
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [micEnabled, setMicEnabled] = React.useState(true);

  // Active Session State
  const [interviewStarted, setInterviewStarted] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState(3600);
  const [currentQuestion, setCurrentQuestion] = React.useState("");
  const [questionNumber, setQuestionNumber] = React.useState(1);
  const [isAiSpeaking, setIsAiSpeaking] = React.useState(false);
  const [isProcessingTurn, setIsProcessingTurn] = React.useState(false);
  const [candidateAnswer, setCandidateAnswer] = React.useState("");
  const [transcript, setTranscript] = React.useState<InterviewTranscriptTurn[]>([]);
  const [showCaptions, setShowCaptions] = React.useState(true);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = React.useState(false);

  // Proctoring events
  const [proctoringEvents, setProctoringEvents] = React.useState<ProctoringEvent[]>([]);

  // Completed result state
  const [completedResult, setCompletedResult] = React.useState<CompletedResult | null>(null);

  const supabase = createBrowserClient(REAL_URL, REAL_KEY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null);
  const startTimeRef = React.useRef<number>(Date.now());

  // ── 1. Initial Load & Assignment Resolution ─────────────────────────────
  React.useEffect(() => {
    const loadAssignmentDetails = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setErrorMsg("Unauthorized access. Please log in to candidate portal.");
          setLoading(false);
          return;
        }

        // Fetch candidate profile for fallback resolution (auto-create if missing)
        let { data: candidateProf } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!candidateProf) {
          const { data: newCand } = await supabase
            .schema("candidate")
            .from("candidates")
            .insert({
              user_id: authUser.id,
              email: authUser.email || "",
              first_name: authUser.user_metadata?.first_name || authUser.email?.split("@")[0] || "Candidate",
              last_name: authUser.user_metadata?.last_name || "",
            })
            .select("id")
            .maybeSingle();

          candidateProf = newCand || { id: authUser.id };
        }

        // Strategy 1: Direct ID match in assessment.assignments
        let assignment: any = null;
        const { data: directMatch, error: assignErr } = await supabase
          .schema("assessment")
          .from("assignments")
          .select("id, assessment_id, scheduled_start_at, status")
          .eq("id", assignmentId)
          .maybeSingle();

        if (!assignErr && directMatch && directMatch.status !== "completed") {
          assignment = directMatch;
        }

        // Strategy 2: Active assignment fallback for candidate
        if (!assignment && candidateProf?.id) {
          const { data: candidateAssignment } = await supabase
            .schema("assessment")
            .from("assignments")
            .select("id, assessment_id, scheduled_start_at, status")
            .eq("candidate_id", candidateProf.id)
            .in("status", ["assigned", "in_progress"])
            .order("scheduled_start_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (candidateAssignment) {
            assignment = candidateAssignment;
          }
        }

        if (!assignment && directMatch) {
          assignment = directMatch;
        }

        if (!assignment) {
          setErrorMsg("AI Interview Assignment not found. Please contact recruiter.");
          setLoading(false);
          return;
        }

        setResolvedAssignmentId(assignment.id);

        // Fetch template duration
        const { data: tmpl } = await supabase
          .schema("assessment")
          .from("assessments")
          .select("title, duration_minutes")
          .eq("id", assignment.assessment_id)
          .maybeSingle();

        if (tmpl?.title) {
          const cleanTitle = tmpl.title
            .replace(/Coding\s*Interview\s*Assessment/gi, "AI Live Technical Interview")
            .replace(/Coding\s*Assessment/gi, "AI Live Technical Interview")
            .replace(/MCQ\s*Assessment/gi, "AI Live Technical Interview")
            .replace(/\s*\([^)]*PDF[^)]*\)/gi, "")
            .replace(/PDF\s*Template\s*/gi, "")
            .trim();
          setAssessmentTitle(cleanTitle || "AI Live Technical Interview");
        }
        const effectiveDuration = tmpl?.duration_minutes ? Number(tmpl.duration_minutes) : 60;
        setDurationMinutes(effectiveDuration);

        // Fetch attempt
        const { data: attempt } = await supabase
          .schema("assessment")
          .from("attempts")
          .select("*")
          .eq("assignment_id", assignment.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isActuallyCompleted = assignment.status === "completed" ||
          (attempt?.status === "completed" && assignment.status !== "assigned");

        if (isActuallyCompleted) {
          const ans = attempt?.answers || {};
          setCompletedResult({
            overallScore: attempt?.score ?? 0,
            passed: attempt?.passed ?? ((attempt?.score ?? 0) >= 60),
            evaluation: ans.evaluation || {
              overallScore: attempt?.score ?? 0,
              passed: attempt?.passed ?? false,
              summary: "Interview completed and evaluated.",
              technicalCompetence: { score: attempt?.score ?? 0, reasoning: "", evidence: [] },
              problemSolving: { score: attempt?.score ?? 0, reasoning: "", evidence: [] },
              communication: { score: attempt?.score ?? 0, reasoning: "", evidence: [] },
              appliedExperience: { score: attempt?.score ?? 0, reasoning: "", evidence: [] },
              professionalJudgment: { score: attempt?.score ?? 0, reasoning: "", evidence: [] },
              strengths: [],
              developmentAreas: [],
              questionReviews: [],
            },
            transcript: Array.isArray(ans.transcript) ? ans.transcript : [],
            timeSpentSeconds: attempt?.time_spent_seconds ?? 0,
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        logger.error("Failed to initialize candidate AI interview exam page", err);
        setErrorMsg("An unexpected error occurred loading the AI Interview.");
      } finally {
        setLoading(false);
      }
    };

    loadAssignmentDetails();
  }, [assignmentId, supabase]);

  // ── 2. Speech Synthesis (TTS) Helper ────────────────────────────────────
  const speakQuestionAloud = React.useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = () => setIsAiSpeaking(false);
      utterance.onerror = () => setIsAiSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      logger.warn("SpeechSynthesis error", e);
      setIsAiSpeaking(false);
    }
  }, []);

  // ── 3. Speech Recognition (STT) Setup ───────────────────────────────────
  const startSpeechRecognition = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        let transcriptText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcriptText += event.results[i][0].transcript;
        }
        if (transcriptText.trim()) {
          setCandidateAnswer(transcriptText);
        }
      };

      rec.onerror = (err: any) => {
        if (err.error !== "no-speech") {
          logger.warn("SpeechRecognition error", err);
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      logger.warn("SpeechRecognition init exception", e);
    }
  }, []);

  // ── 4. Authoritative Countdown Timer ────────────────────────────────────
  React.useEffect(() => {
    if (!interviewStarted) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmission();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interviewStarted]);

  // Sync videoRef stream when room activates
  React.useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [interviewStarted]);

  // ── 5. Device Test Handler (Camera + Mic) ───────────────────────────────
  const handleTestDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
      streamRef.current = stream;
      setMicActive(true);
      setCameraActive(true);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      setErrorMsg("Microphone or Camera permission denied. Please allow microphone and camera access in your browser to start.");
    }
  };

  // ── 6. Start Interview Handler ──────────────────────────────────────────
  const handleStartInterview = async () => {
    try {
      setLoading(true);
      if (!streamRef.current) {
        await handleTestDevices();
      }

      const res = await fetch("/api/candidate/ai-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: resolvedAssignmentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "completed") {
          window.location.reload();
          return;
        }
        throw new Error(data.message || data.error || "Failed to initialize AI Interview");
      }

      setRemainingSeconds(data.remainingSeconds || durationMinutes * 60);
      setDurationMinutes(data.durationMinutes || 60);
      setJobTitle(data.jobTitle || "Technical Position");
      setCandidateName(data.candidateName || "Candidate");
      setCurrentQuestion(data.firstQuestion);
      setQuestionNumber(data.questionNumber || 1);
      startTimeRef.current = Date.now();

      // Append initial interviewer turn
      const nowFormatted = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setTranscript([{
        speaker: "interviewer",
        text: data.firstQuestion,
        timestampMs: Date.now(),
        timeFormatted: nowFormatted,
      }]);

      setInterviewStarted(true);

      // Trigger browser full screen & read question
      if (typeof document !== "undefined" && document.documentElement?.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      speakQuestionAloud(data.firstQuestion);
      startSpeechRecognition();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start AI Interview session");
    } finally {
      setLoading(false);
    }
  };

  // ── 7. Turn Submission Handler (Process Turn) ───────────────────────────
  const handleTurnSubmit = async () => {
    if (isProcessingTurn) return;
    try {
      setIsProcessingTurn(true);
      const answerText = candidateAnswer.trim();
      const nowFormatted = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      // Append candidate turn to transcript
      const updatedTranscript: InterviewTranscriptTurn[] = [
        ...transcript,
        {
          speaker: "candidate",
          text: answerText || "(No verbal response provided)",
          timestampMs: Date.now(),
          timeFormatted: nowFormatted,
        },
      ];
      setTranscript(updatedTranscript);
      setCandidateAnswer("");

      // Stop speech recognition while processing
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      // Call single turn endpoint
      const res = await fetch("/api/candidate/ai-interview/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: resolvedAssignmentId,
          currentQuestion,
          candidateAnswer: answerText,
          questionNumber,
          remainingSeconds,
          durationMinutes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Turn processing error");
      }

      if (data.nextAction === "conclude" || !data.nextQuestion) {
        await handleFinalSubmission(updatedTranscript);
        return;
      }

      // Set next question
      const nextQ = data.nextQuestion;
      const nextNum = data.questionNumber || questionNumber + 1;
      setCurrentQuestion(nextQ);
      setQuestionNumber(nextNum);

      setTranscript((prev) => [
        ...prev,
        {
          speaker: "interviewer",
          text: nextQ,
          timestampMs: Date.now(),
          timeFormatted: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      speakQuestionAloud(nextQ);
      startSpeechRecognition();
    } catch (err: any) {
      logger.error("Turn submission error", err);
    } finally {
      setIsProcessingTurn(false);
    }
  };

  // ── 8. Final Submission Handler ─────────────────────────────────────────
  const handleFinalSubmission = async (currentTranscriptOverride?: InterviewTranscriptTurn[]) => {
    try {
      setLoading(true);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const activeTranscript = currentTranscriptOverride || transcript;
      const elapsedSecs = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));

      const res = await fetch("/api/candidate/ai-interview/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: resolvedAssignmentId,
          transcript: activeTranscript,
          timeSpentSeconds: elapsedSecs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process final evaluation");
      }

      setCompletedResult({
        overallScore: data.overallScore,
        passed: data.passed,
        evaluation: data.evaluation,
        transcript: activeTranscript,
        timeSpentSeconds: elapsedSecs,
      });

      if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      setErrorMsg(`Submission error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ── 9. LOADING STATE ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-zinc-950 text-white font-sans">
        <Loader2 className="h-9 w-9 animate-spin text-blue-500" />
        <p className="text-xs text-zinc-400 font-bold mt-4 tracking-wider uppercase animate-pulse">Initializing AI Interview Room...</p>
      </div>
    );
  }

  // ── 10. ERROR STATE ──
  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-zinc-950 px-6 py-12 text-white font-sans">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">AI Interview Unavailable</h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">{errorMsg}</p>
          </div>
          <Link
            href="/candidate/assessments"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer"
          >
            Return to Assessments
          </Link>
        </div>
      </div>
    );
  }

  // ── 11. COMPLETED RESULT SCREEN ──
  if (completedResult) {
    const { evaluation, transcript: resTranscript, timeSpentSeconds, overallScore, passed } = completedResult;
    const timeStr = timeSpentSeconds > 0
      ? `${Math.floor(timeSpentSeconds / 60)}m ${timeSpentSeconds % 60}s`
      : "—";

    return (
      <div className="h-dvh bg-zinc-950 text-white font-sans overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${passed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                {passed ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block">AI Interview Evaluated</span>
                <h1 className="text-xl font-extrabold text-white">Live Technical Interview Result</h1>
              </div>
            </div>
            <a
              href={`/api/assessments/${resolvedAssignmentId}/interview-transcript/pdf`}
              className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-zinc-700 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4 text-blue-400" /> Download Transcript PDF
            </a>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Overall Score</span>
              <span className="text-2xl font-black text-blue-400">{overallScore}%</span>
            </div>
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Duration Spent</span>
              <span className="text-sm font-bold text-zinc-200">{timeStr}</span>
            </div>
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Meaningful Answers</span>
              <span className="text-xl font-extrabold text-white">
                {evaluation?.meaningfulAnswersCount ?? 0} / {evaluation?.totalQuestionsAsked ?? (Math.floor(resTranscript.length / 2) || 1)}
              </span>
            </div>
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Status</span>
              <span className={`text-sm font-extrabold ${passed ? "text-emerald-400" : evaluation?.evaluationStatus === "insufficient_evidence" ? "text-amber-400" : "text-red-400"}`}>
                {passed ? "PASSED" : evaluation?.evaluationStatus === "insufficient_evidence" ? "INSUFFICIENT EVIDENCE" : "REVIEW / UNMET"}
              </span>
            </div>
          </div>

          {/* 5-Dimension Rubric Breakdown */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
            <h2 className="text-xs font-extrabold text-zinc-300 uppercase tracking-wider">Competency Rubric Evaluation</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricBox label="Technical (40%)" score={evaluation.technicalCompetence?.score} evidenceStatus={evaluation.technicalCompetence?.evidenceStatus} color="blue" />
              <MetricBox label="Problem Solving (20%)" score={evaluation.problemSolving?.score} evidenceStatus={evaluation.problemSolving?.evidenceStatus} color="emerald" />
              <MetricBox label="Communication (15%)" score={evaluation.communication?.score} evidenceStatus={evaluation.communication?.evidenceStatus} color="purple" />
              <MetricBox label="Experience (15%)" score={evaluation.appliedExperience?.score} evidenceStatus={evaluation.appliedExperience?.evidenceStatus} color="indigo" />
              <MetricBox label="Judgment (10%)" score={evaluation.professionalJudgment?.score} evidenceStatus={evaluation.professionalJudgment?.evidenceStatus} color="amber" />
            </div>
          </div>

          {/* Strengths & Development Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Key Candidate Strengths</h3>
              {(!evaluation.strengths || evaluation.strengths.length === 0) ? (
                <p className="text-xs text-zinc-500 italic">No interview strengths could be established from the available responses.</p>
              ) : (
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-zinc-300">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Areas for Growth</h3>
              <ul className="space-y-1.5 list-disc pl-4 text-xs text-zinc-300">
                {(evaluation.developmentAreas || []).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Transcript List */}
          <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Full Conversational Transcript</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {resTranscript.map((t, idx) => (
                <div key={idx} className={`p-3 rounded-xl border text-xs space-y-1 ${t.speaker === "interviewer" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-blue-950/40 border-blue-900/50 text-blue-200"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                    {t.speaker === "interviewer" ? "AI Interviewer (Alex)" : candidateName}
                  </span>
                  <p className="leading-relaxed">{t.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/candidate/assessments"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all cursor-pointer"
            >
              Return to Assessments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 12. ACTIVE INTERVIEW ROOM ──
  if (interviewStarted) {
    return (
      <div className="h-dvh w-dvw bg-zinc-950 text-white font-sans overflow-hidden flex flex-col justify-between select-none">
        {/* Top Navigation Bar */}
        <div className="h-14 bg-zinc-900/90 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white truncate">{jobTitle}</h1>
              <span className="text-[10px] text-zinc-400 block font-mono">SmartHire AI Interview Room</span>
            </div>
          </div>

          {/* Status & Timer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-extrabold text-amber-400 font-mono">{formatTime(remainingSeconds)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-bold text-emerald-400">Proctoring Guard Active</span>
            </div>
            <button
              onClick={() => handleFinalSubmission()}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <PhoneOff className="h-3.5 w-3.5" /> End Interview
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 min-h-0 overflow-hidden">
          {/* Left Column: AI Question & Controls */}
          <div className="md:col-span-2 flex flex-col justify-between bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 overflow-hidden">
            {/* AI Avatar & Question Display */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                    AI
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">SmartHire AI Interviewer (Alex)</span>
                    <span className="text-[10px] text-zinc-400 block font-mono">Adaptive Question #{questionNumber}</span>
                  </div>
                </div>

                {isAiSpeaking ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                    <Volume2 className="h-3.5 w-3.5 animate-pulse" /> Speaking...
                  </span>
                ) : isProcessingTurn ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing next question...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                    <Mic className="h-3.5 w-3.5" /> Listening to your response
                  </span>
                )}
              </div>

              {/* Question Text Box */}
              <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 min-h-[140px] flex flex-col justify-center shadow-inner">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">Current Question</span>
                <p className="text-base md:text-lg font-bold text-white leading-relaxed">{currentQuestion}</p>
              </div>

              {/* Live Candidate Answer Transcript Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-400" /> Your Live Speech Response
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Hands-Free Auto Voice Input</span>
                </div>
                <textarea
                  value={candidateAnswer}
                  onChange={(e) => setCandidateAnswer(e.target.value)}
                  placeholder="Speak clearly into your microphone... your response will automatically transcribe here."
                  rows={2}
                  className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 resize-none font-sans"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
              <button
                onClick={() => speakQuestionAloud(currentQuestion)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 text-blue-400" /> Repeat Question
              </button>

              <button
                onClick={handleTurnSubmit}
                disabled={isProcessingTurn}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessingTurn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span> <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Candidate WebCam Preview & Subtitles */}
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Candidate Video Container */}
            <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraEnabled ? "block" : "hidden"}`}
              />
              {!cameraEnabled && (
                <div className="text-center space-y-2">
                  <VideoOff className="h-8 w-8 text-zinc-600 mx-auto" />
                  <span className="text-xs text-zinc-500 font-bold block">Camera Muted</span>
                </div>
              )}

              {/* Video Overlay Info */}
              <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-800 text-[10px] font-bold text-zinc-300">
                {candidateName}
              </div>

              {/* Mic Decibel Meter */}
              <div className="absolute bottom-3 left-3 right-3 bg-zinc-950/80 backdrop-blur-md p-2 rounded-xl border border-zinc-800/80 flex items-center gap-2">
                <Mic className={`h-3.5 w-3.5 ${micEnabled ? "text-emerald-400" : "text-zinc-600"}`} />
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-75"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
                <span className="text-[9px] text-zinc-400 font-mono">{micVolume}%</span>
              </div>
            </div>

            {/* Media Control Toggles */}
            <div className="flex items-center justify-center gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80">
              <button
                onClick={() => setMicEnabled(!micEnabled)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${micEnabled ? "bg-zinc-800 text-zinc-200 border-zinc-700" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${cameraEnabled ? "bg-zinc-800 text-zinc-200 border-zinc-700" : "bg-red-500/20 text-red-400 border-red-500/30"}`}
                title={cameraEnabled ? "Turn Off Camera" : "Turn On Camera"}
              >
                {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setShowCaptions(!showCaptions)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${showCaptions ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                title="Toggle Live Subtitles"
              >
                <Subtitles className="h-4 w-4" />
              </button>
            </div>

            {/* Subtitles & Transcript Box */}
            <div className="flex-1 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Interview Activity</span>
                <span className="text-[10px] text-blue-400 font-bold">{transcript.length} turns recorded</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {transcript.map((t, i) => (
                  <div key={i} className={`p-2.5 rounded-xl border ${t.speaker === "interviewer" ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-blue-950/40 border-blue-900/40 text-blue-200"}`}>
                    <span className="text-[9px] font-bold uppercase block text-zinc-500 mb-0.5">
                      {t.speaker === "interviewer" ? "AI Interviewer" : "Candidate"}
                    </span>
                    <p className="text-[11px] leading-relaxed line-clamp-3">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 13. PRE-INTERVIEW INSTRUCTIONS & DEVICE CHECK LOBBY ──
  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-8 flex items-center justify-center text-white font-sans selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">
              Real-Time Conversational AI Interview
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{assessmentTitle}</h1>
            <p className="text-xs text-zinc-400 font-medium">Position: {jobTitle}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center gap-2.5 text-xs">
              <Clock className="h-4 w-4 text-amber-400" />
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase block">Duration</span>
                <span className="font-extrabold text-amber-400">{durationMinutes} Mins</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center gap-2.5 text-xs">
              <Mic className="h-4 w-4 text-emerald-400" />
              <div>
                <span className="text-[9px] font-bold text-zinc-500 uppercase block">Format</span>
                <span className="font-extrabold text-emerald-400">Live Voice</span>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Instructions & Precautions Rectangle Banner */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/90 space-y-3">
          <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-blue-400" /> Pre-Interview Precautions & Guidelines
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
              <span className="font-bold text-blue-400 text-[11px] block flex items-center gap-1.5">
                🎙️ Speak Naturally
              </span>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                The AI interviewer reads questions aloud. Speak clearly to answer after each prompt.
              </p>
            </div>

            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
              <span className="font-bold text-amber-400 text-[11px] block flex items-center gap-1.5">
                ⏱️ Timed Session ({durationMinutes} mins)
              </span>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Server-authoritative timer limits the session. Unfinished answers auto-evaluate at expiry.
              </p>
            </div>

            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
              <span className="font-bold text-emerald-400 text-[11px] block flex items-center gap-1.5">
                🔒 Proctoring & Fullscreen
              </span>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Full-screen mode activates on start. Switching tabs or window focus logs proctoring alerts.
              </p>
            </div>
          </div>
        </div>

        {/* WebCam & Mic Check Widget — Horizontal Grid */}
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Mic className="h-4 w-4 text-emerald-400" /> WebCam & Microphone Setup Check
            </span>
            {(!micActive || !cameraActive) ? (
              <button
                onClick={handleTestDevices}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Video className="h-3.5 w-3.5" /> Test Camera & Mic
              </button>
            ) : (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Camera & Mic Connected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-6 relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
              />
              {!cameraActive && (
                <div className="text-center space-y-1 p-3">
                  <Video className="h-6 w-6 text-zinc-600 mx-auto" />
                  <span className="text-[10px] text-zinc-500 block font-medium">Camera Offline — Click Test Camera & Mic</span>
                </div>
              )}
            </div>

            <div className="md:col-span-6 space-y-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Microphone Volume Level</span>
                <div className="h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-75"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 block text-right font-mono mt-1">{micVolume}%</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Ensure browser camera & mic permissions are allowed so the AI interviewer can hear and process your spoken responses.
              </p>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
          <Link
            href="/candidate/assessments"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs px-6 py-3 rounded-xl border border-zinc-700 transition-all text-center cursor-pointer"
          >
            Cancel
          </Link>
          <button
            onClick={handleStartInterview}
            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
          >
            <span>Start AI Live Interview</span> <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, score, evidenceStatus, color }: { label: string; score?: number; evidenceStatus?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    indigo: "text-indigo-400",
    purple: "text-purple-400",
  };

  const isInsufficient = evidenceStatus === "insufficient_evidence" || score === 0 || score === undefined;

  return (
    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
      <span className="text-[9px] font-bold text-zinc-400 uppercase block">{label}</span>
      {isInsufficient ? (
        <span className="text-[11px] font-bold text-amber-400 block font-mono">Insufficient Evidence</span>
      ) : (
        <span className={`text-xl font-black ${colorMap[color] || "text-white"}`}>{score}%</span>
      )}
    </div>
  );
}
