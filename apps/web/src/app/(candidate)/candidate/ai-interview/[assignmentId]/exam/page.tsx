"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { LiveInterviewIDE } from "@/components/interview/LiveInterviewIDE";
import { InterviewTranscriptTurn, StructuredInterviewEvaluation } from "@/services/ai/live-interview-service";
import {
  Loader2,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  Award,
  Mic,
  Volume2,
  FileText,
  Download,
  XCircle,
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

export default function CandidateAIInterviewExamPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Pre-interview state
  const [assessmentTitle, setAssessmentTitle] = React.useState("AI Live Technical Interview");
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [jobTitle, setJobTitle] = React.useState("Technical Position");
  const [candidateName, setCandidateName] = React.useState("Candidate");

  // Mic test state
  const [micActive, setMicActive] = React.useState(false);
  const [micVolume, setMicVolume] = React.useState(0);

  // Active Live session state
  const [interviewStarted, setInterviewStarted] = React.useState(false);
  const [ephemeralToken, setEphemeralToken] = React.useState("");
  const [remainingSeconds, setRemainingSeconds] = React.useState(3600);
  const [systemPrompt, setSystemPrompt] = React.useState("");

  // Completed result state
  const [completedResult, setCompletedResult] = React.useState<CompletedResult | null>(null);

  const supabase = createBrowserClient(REAL_URL, REAL_KEY);

  React.useEffect(() => {
    const loadAssignmentDetails = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setErrorMsg("Unauthorized access. Please log in to candidate portal.");
          setLoading(false);
          return;
        }

        // Fetch assignment
        const { data: assignment, error: assignErr } = await supabase
          .schema("assessment")
          .from("assignments")
          .select("id, assessment_id, scheduled_start_at, status")
          .eq("id", assignmentId)
          .maybeSingle();

        if (assignErr || !assignment) {
          setErrorMsg("AI Interview Assignment not found. Please contact recruiter.");
          setLoading(false);
          return;
        }

        // Fetch template duration
        const { data: tmpl } = await supabase
          .schema("assessment")
          .from("assessments")
          .select("title, duration_minutes")
          .eq("id", assignment.assessment_id)
          .maybeSingle();

        if (tmpl?.title) setAssessmentTitle(tmpl.title);
        const effectiveDuration = tmpl?.duration_minutes ? Number(tmpl.duration_minutes) : 60;
        setDurationMinutes(effectiveDuration);

        // Fetch attempt
        const { data: attempt } = await supabase
          .schema("assessment")
          .from("attempts")
          .select("*")
          .eq("assignment_id", assignmentId)
          .maybeSingle();

        if (assignment.status === "completed" || attempt?.status === "completed") {
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

        if (assignment.scheduled_start_at && new Date(assignment.scheduled_start_at) > new Date()) {
          setErrorMsg(`AI Interview Locked: Scheduled for ${new Date(assignment.scheduled_start_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}.`);
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

  // Mic Testing Handler
  const handleTestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicActive(true);

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
        setMicVolume(Math.min(100, Math.round(avg * 2.5)));
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      setErrorMsg("Microphone access denied. Please allow microphone permissions to start.");
    }
  };

  // Start Live Session Handler
  const handleStartLiveInterview = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/candidate/ai-interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to initialize Live session");
      }

      setEphemeralToken(data.ephemeralToken);
      setRemainingSeconds(data.remainingSeconds);
      setDurationMinutes(data.durationMinutes);
      setJobTitle(data.jobTitle);
      setCandidateName(data.candidateName);
      setSystemPrompt(data.systemPrompt);

      // Trigger browser native full screen
      if (typeof document !== "undefined" && document.documentElement?.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      setInterviewStarted(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start AI Interview session");
    } finally {
      setLoading(false);
    }
  };

  // Submit Final Transcript Handler
  const handleSubmitTranscript = async (transcriptList: InterviewTranscriptTurn[], timeSpentSeconds: number) => {
    try {
      setLoading(true);
      const res = await fetch("/api/candidate/ai-interview/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          transcript: transcriptList,
          timeSpentSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process evaluation");
      }

      setCompletedResult({
        overallScore: data.overallScore,
        passed: data.passed,
        evaluation: data.evaluation,
        transcript: transcriptList,
        timeSpentSeconds,
      });

      // Exit fullscreen
      if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      setErrorMsg(`Submission error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── 1. LOADING ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-zinc-950 text-white font-sans">
        <Loader2 className="h-9 w-9 animate-spin text-blue-500" />
        <p className="text-xs text-zinc-400 font-bold mt-4 tracking-wider uppercase animate-pulse">Initializing Live Session...</p>
      </div>
    );
  }

  // ── 2. ERROR ──
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

  // ── 3. COMPLETED RESULT ──
  if (completedResult) {
    const { evaluation, transcript, timeSpentSeconds, overallScore, passed } = completedResult;
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
              href={`/api/assessments/${assignmentId}/interview-transcript/pdf`}
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
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Speech Turns</span>
              <span className="text-xl font-extrabold text-white">{transcript.length} turns</span>
            </div>
            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Status</span>
              <span className={`text-sm font-extrabold ${passed ? "text-emerald-400" : "text-amber-400"}`}>{passed ? "PASSED" : "REVIEW"}</span>
            </div>
          </div>

          {/* 5-Dimension Rubric Breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 text-left">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-400" /> Competency Rubric Evaluation
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <MetricBox label="Technical (40%)" score={evaluation.technicalCompetence?.score} color="blue" />
              <MetricBox label="Problem Solving (20%)" score={evaluation.problemSolving?.score} color="emerald" />
              <MetricBox label="Communication (15%)" score={evaluation.communication?.score} color="amber" />
              <MetricBox label="Experience (15%)" score={evaluation.appliedExperience?.score} color="indigo" />
              <MetricBox label="Judgment (10%)" score={evaluation.professionalJudgment?.score} color="purple" />
            </div>

            {/* Strengths & Development Areas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2">
                <span className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider block">Key Candidate Strengths</span>
                <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                  {evaluation.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
                <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider block">Areas for Growth</span>
                <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                  {evaluation.developmentAreas?.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          </div>

          {/* Transcript Viewer */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 text-left">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" /> Full Conversational Transcript
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {transcript.map((t, idx) => (
                <div key={idx} className={`p-3 rounded-xl border text-xs ${t.speaker === 'interviewer' ? 'bg-blue-950/20 border-blue-500/20' : 'bg-zinc-950 border-zinc-800 ml-4'}`}>
                  <span className={`font-bold uppercase text-[10px] block ${t.speaker === 'interviewer' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {t.speaker === 'interviewer' ? 'AI Interviewer' : 'You'} &bull; [{t.timeFormatted}]
                  </span>
                  <p className="text-zinc-200 mt-1">{t.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Return */}
          <div className="pt-2">
            <Link
              href="/candidate/assessments"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-3.5 rounded-xl border border-zinc-700 transition-all text-center block cursor-pointer"
            >
              Return to Assessments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 4. ACTIVE LIVE INTERVIEW ──
  if (interviewStarted) {
    return (
      <LiveInterviewIDE
        ephemeralToken={ephemeralToken}
        remainingSeconds={remainingSeconds}
        durationMinutes={durationMinutes}
        assessmentTitle={assessmentTitle}
        candidateName={candidateName}
        jobTitle={jobTitle}
        systemPrompt={systemPrompt}
        onFinish={handleSubmitTranscript}
      />
    );
  }

  // ── 5. PRE-INTERVIEW INSTRUCTIONS & MIC TEST ──
  return (
    <div className="flex items-center justify-center h-dvh bg-zinc-950 px-6 py-12 text-white font-sans">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl text-left">

        {/* Title */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">Real-Time Conversational AI Interview</span>
            <h1 className="text-xl font-extrabold text-white">{assessmentTitle}</h1>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        {/* Spec Pill */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Duration</span>
              <span className="text-sm font-extrabold text-amber-400">{durationMinutes} Minutes</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3">
            <Mic className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Format</span>
              <span className="text-sm font-extrabold text-emerald-400">Live Voice Conversation</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 bg-zinc-950 p-5 rounded-xl border border-zinc-800 text-xs leading-relaxed text-zinc-300">
          <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-blue-400" /> Interview Instructions
          </h3>
          <ul className="space-y-2 list-disc pl-4 text-zinc-400">
            <li>An AI interviewer will introduce itself and ask role-relevant questions.</li>
            <li>Speak naturally into your microphone when replying.</li>
            <li>The AI will ask follow-up questions based on your technical responses.</li>
            <li>The session is timed ({durationMinutes} minutes server-authoritative limit).</li>
            <li>Full-screen viewport activates automatically when you start.</li>
          </ul>
        </div>

        {/* Microphone Test Widget */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Mic className="h-4 w-4 text-emerald-400" /> Microphone Device Check
            </span>
            {!micActive ? (
              <button
                onClick={handleTestMicrophone}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-700 transition-all cursor-pointer"
              >
                Test Microphone
              </button>
            ) : (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Detected
              </span>
            )}
          </div>

          {micActive && (
            <div className="space-y-1">
              <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-75"
                  style={{ width: `${micVolume}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500 block text-right font-mono">Input Level: {micVolume}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 flex gap-3">
          <Link
            href="/candidate/assessments"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-3.5 rounded-xl border border-zinc-700 transition-all text-center cursor-pointer"
          >
            Cancel
          </Link>
          <button
            onClick={handleStartLiveInterview}
            className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Start AI Live Interview</span> <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, score, color }: { label: string; score?: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    indigo: "text-indigo-400",
    purple: "text-purple-400",
  };

  return (
    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
      <span className="text-[9px] font-bold text-zinc-400 uppercase block">{label}</span>
      <span className={`text-xl font-black ${colorMap[color] || "text-white"}`}>{score ?? "—"}%</span>
    </div>
  );
}
