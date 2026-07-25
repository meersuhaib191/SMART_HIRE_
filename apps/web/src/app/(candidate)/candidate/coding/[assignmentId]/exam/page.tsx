"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { CodingExamIDE, CodingQuestion } from "@/components/coding/CodingExamIDE";
import { Loader2, ArrowRight, CheckCircle2, ShieldCheck, Clock, Code2, AlertCircle, FileCode, Award, ChevronLeft, Eye, XCircle, Download } from "lucide-react";
import { logger } from "@smarthire/logger";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface QuestionResultItem {
  questionId: string;
  questionSnapshot: {
    title: string;
    description: string;
    difficulty: string;
    maxPoints: number;
  };
  status: string;
  language: string;
  submittedCode: string;
  functionalPct: number;
  passedTests: number;
  totalTests: number;
  efficiency: { score: number | null; reason: string } | null;
  codeQuality: { score: number | null; reason: string } | null;
  readability: { score: number | null; reason: string } | null;
  robustness: { score: number | null; reason: string } | null;
  complexity: { time: string; space: string } | null;
  strengths: string[];
  improvements: string[];
  questionScore: number;
}

interface AssessmentSummary {
  totalProblems: number;
  attempted: number;
  totalTests: number;
  passedTests: number;
  overallScore: number;
  timeUsedSeconds: number;
  submittedAt: string;
}

interface CompletedResult {
  overallScore: number;
  passed: boolean;
  summary: AssessmentSummary;
  questionResults: QuestionResultItem[];
}

export default function CandidateCodingExamPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [examStarted, setExamStarted] = React.useState(false);

  const [assessmentTitle, setAssessmentTitle] = React.useState<string>("Coding Assessment");
  const [durationMinutes, setDurationMinutes] = React.useState<number>(60);
  const [questions, setQuestions] = React.useState<CodingQuestion[]>([]);
  const [expandedCode, setExpandedCode] = React.useState<Record<string, boolean>>({});

  // Submission completion state
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

        // Fetch assignment record
        const { data: assignment, error: assignErr } = await supabase
          .schema("assessment")
          .from("assignments")
          .select("id, assessment_id, scheduled_start_at, status")
          .eq("id", assignmentId)
          .maybeSingle();

        if (assignErr || !assignment) {
          setErrorMsg("Coding Assessment Assignment not found. Please contact the recruiter.");
          setLoading(false);
          return;
        }

        // Fetch assessment template duration & title
        const { data: tmpl } = await supabase
          .schema("assessment")
          .from("assessments")
          .select("title, duration_minutes")
          .eq("id", assignment.assessment_id)
          .maybeSingle();

        if (tmpl?.title) setAssessmentTitle(tmpl.title);
        const effectiveDuration = tmpl?.duration_minutes ? Number(tmpl.duration_minutes) : 60;
        setDurationMinutes(effectiveDuration);

        // Fetch attempt record if exists
        const { data: attempt } = await supabase
          .schema("assessment")
          .from("attempts")
          .select("*")
          .eq("assignment_id", assignmentId)
          .maybeSingle();

        if (assignment.status === "completed" || attempt?.status === "completed") {
          const ans = attempt?.answers || {};

          // Build result from persisted per-question data
          const qResults: QuestionResultItem[] = Array.isArray(ans.questionResults)
            ? ans.questionResults
            : [];

          const summary: AssessmentSummary = ans.assessmentSummary || {
            totalProblems: qResults.length || 1,
            attempted: qResults.filter((q: any) => q.status === "completed").length,
            totalTests: ans.totalCases ?? 0,
            passedTests: ans.passedCases ?? 0,
            overallScore: attempt?.score ?? 0,
            timeUsedSeconds: attempt?.time_spent_seconds ?? 0,
            submittedAt: attempt?.completed_at || new Date().toISOString(),
          };

          // If no per-question results (legacy data), create a single-question fallback
          if (qResults.length === 0 && ans.code) {
            qResults.push({
              questionId: "legacy",
              questionSnapshot: {
                title: assessmentTitle || "Coding Problem",
                description: "",
                difficulty: "medium",
                maxPoints: 10,
              },
              status: ans.functionalPct > 0 || ans.deterministicScorePct > 0 ? "completed" : "not_attempted",
              language: ans.language || "python",
              submittedCode: ans.code || "",
              functionalPct: ans.functionalPct ?? ans.deterministicScorePct ?? 0,
              passedTests: ans.passedCases ?? 0,
              totalTests: ans.totalCases ?? 0,
              efficiency: ans.efficiencyPct != null ? { score: ans.efficiencyPct, reason: "" } : null,
              codeQuality: ans.codeQualityPct != null ? { score: ans.codeQualityPct, reason: "" } : null,
              readability: ans.readabilityPct != null ? { score: ans.readabilityPct, reason: "" } : null,
              robustness: ans.robustnessPct != null ? { score: ans.robustnessPct, reason: "" } : null,
              complexity: ans.geminiResult?.timeComplexity
                ? { time: ans.geminiResult.timeComplexity, space: ans.geminiResult.spaceComplexity || "—" }
                : null,
              strengths: ans.geminiResult?.strengths || [],
              improvements: ans.geminiResult?.improvements || [],
              questionScore: attempt?.score ?? 0,
            });
          }

          setCompletedResult({
            overallScore: summary.overallScore,
            passed: attempt?.passed ?? (summary.overallScore >= 60),
            summary,
            questionResults: qResults,
          });
          setLoading(false);
          return;
        }

        // Check if candidate already started the attempt in a previous session
        if (attempt?.started_at && attempt.status === "in_progress") {
          setExamStarted(true);
        }

        // Scheduled start time check
        if (assignment.scheduled_start_at && new Date(assignment.scheduled_start_at) > new Date()) {
          setErrorMsg(`Coding Assessment Locked: Scheduled for ${new Date(assignment.scheduled_start_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}.`);
          setLoading(false);
          return;
        }

        // Fetch questions specifically uploaded for this assessment
        const { data: questionRows } = await supabase
          .schema("assessment")
          .from("questions")
          .select("*")
          .eq("assessment_id", assignment.assessment_id);

        if (!questionRows || questionRows.length === 0) {
          setErrorMsg("This coding assessment has not been configured correctly by the recruiter.");
          setLoading(false);
          return;
        }

        const mappedQuestions: CodingQuestion[] = questionRows.map((q, idx) => {
          const opts = typeof q.options === "object" && q.options !== null ? q.options : {};
          const allCases = Array.isArray(opts.testCases) ? opts.testCases : [];
          // SECURITY: Strip hidden test cases before client load!
          const publicTestCases = allCases.filter((tc: any) => !tc.hidden);

          return {
            id: q.id,
            title: opts.title || q.title || `Problem ${idx + 1}`,
            difficulty: (q.difficulty as "easy" | "medium" | "hard") || "medium",
            category: q.category || "Algorithms",
            description: opts.description || q.question_text || "Solve the coding problem.",
            inputFormat: opts.inputFormat || "",
            outputFormat: opts.outputFormat || "",
            constraints: opts.constraints || [],
            examples: opts.examples || [],
            testCases: publicTestCases,
            allowedLanguages: opts.allowedLanguages || ["python", "javascript", "cpp", "java", "csharp", "c"],
            starterCode: opts.starterCode || {},
          };
        });

        setQuestions(mappedQuestions);
      } catch (err: unknown) {
        logger.error("Failed to initialize coding exam page", err);
        setErrorMsg("An unexpected error occurred loading the coding assessment.");
      } finally {
        setLoading(false);
      }
    };

    loadAssignmentDetails();
  }, [assignmentId, supabase]);

  const handleStartExamSession = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      const { data: assignment } = await supabase
        .schema("assessment")
        .from("assignments")
        .select("assessment_id")
        .eq("id", assignmentId)
        .single();

      if (profile && assignment) {
        await supabase
          .schema("assessment")
          .from("attempts")
          .upsert({
            assignment_id: assignmentId,
            assessment_id: assignment.assessment_id,
            candidate_id: profile.id,
            started_at: new Date().toISOString(),
            status: "in_progress",
            score: 0,
          });
      }
    } catch (err) {
      logger.error("Error starting exam attempt timestamp", err);
    } finally {
      if (typeof document !== "undefined" && document.documentElement?.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setExamStarted(true);
    }
  };

  const handleSubmitCodingSolution = async (submission: {
    solutions: Array<{ questionId: string; code: string; language: string }>;
    timeSpentSeconds: number;
  }) => {
    const res = await fetch("/api/candidate/coding/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId,
        solutions: submission.solutions,
        timeSpentSeconds: submission.timeSpentSeconds,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to submit coding solution");
    }

    const qResults: QuestionResultItem[] = Array.isArray(data.questionResults) ? data.questionResults : [];
    const summary: AssessmentSummary = data.assessmentSummary || {
      totalProblems: qResults.length,
      attempted: qResults.filter((q: any) => q.status === "completed").length,
      totalTests: data.totalCases || 0,
      passedTests: data.passedCases || 0,
      overallScore: data.finalScorePct || 0,
      timeUsedSeconds: submission.timeSpentSeconds,
      submittedAt: new Date().toISOString(),
    };

    setCompletedResult({
      overallScore: data.finalScorePct || 0,
      passed: data.passed ?? false,
      summary,
      questionResults: qResults,
    });
  };

  // ─── LOADING ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-zinc-950 text-white font-sans">
        <Loader2 className="h-9 w-9 animate-spin text-blue-500" />
        <p className="text-xs text-zinc-400 font-bold mt-4 tracking-wider uppercase animate-pulse">Initializing Assessment Environment...</p>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-zinc-950 px-6 py-12 text-white font-sans">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Assessment Unavailable</h2>
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

  // ─── COMPLETED RESULT (Per-Question Breakdown) ────────────────────────
  if (completedResult) {
    const { summary, questionResults } = completedResult;
    const timeStr = summary.timeUsedSeconds > 0
      ? `${Math.floor(summary.timeUsedSeconds / 60)}m ${summary.timeUsedSeconds % 60}s`
      : "—";

    return (
      <div className="h-dvh bg-zinc-950 text-white font-sans overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${completedResult.passed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                {completedResult.passed ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block">Assessment Submitted</span>
                <h1 className="text-xl font-extrabold text-white">Coding Assessment Result</h1>
              </div>
            </div>
            <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-full border ${completedResult.passed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
              {completedResult.passed ? "PASSED" : "REVIEW"}
            </span>
          </div>

          {/* Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Overall</span>
              <span className="text-2xl font-black text-blue-400">{completedResult.overallScore}%</span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Attempted</span>
              <span className="text-xl font-extrabold text-white">{summary.attempted} / {summary.totalProblems}</span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tests</span>
              <span className="text-xl font-extrabold text-white">{summary.passedTests} / {summary.totalTests}</span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Time Used</span>
              <span className="text-sm font-bold text-zinc-300">{timeStr}</span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Status</span>
              <span className="text-sm font-bold text-emerald-400">Completed</span>
            </div>
          </div>

          {/* Per-Question Breakdown */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-400" /> Per-Question Evaluation
            </h3>

            {questionResults.map((qr, idx) => {
              const isAttempted = qr.status === "completed";
              const codeKey = qr.questionId;

              return (
                <div key={qr.questionId} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  {/* Question Header */}
                  <div className={`px-5 py-3 flex items-center justify-between ${isAttempted ? "bg-zinc-800/50" : "bg-zinc-900"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold text-blue-400">Q{idx + 1}</span>
                      <span className="text-sm font-bold text-white">{qr.questionSnapshot.title}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        qr.questionSnapshot.difficulty === "easy" ? "bg-emerald-500/10 text-emerald-400" :
                        qr.questionSnapshot.difficulty === "hard" ? "bg-rose-500/10 text-rose-400" :
                        "bg-amber-500/10 text-amber-400"
                      }`}>{qr.questionSnapshot.difficulty}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAttempted ? (
                        <>
                          <span className="text-xs font-bold text-emerald-400">{qr.functionalPct}% Functional</span>
                          <span className="text-xs font-bold text-zinc-400">{qr.passedTests}/{qr.totalTests} tests</span>
                          <span className="text-sm font-extrabold text-blue-400">{qr.questionScore}%</span>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5" /> Not Attempted — 0%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Detail (only for attempted) */}
                  {isAttempted && (
                    <div className="px-5 py-4 space-y-4 border-t border-zinc-800/50">
                      {/* Metric bars */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
                        <MetricPill label="Functional (70%)" value={qr.functionalPct} color="emerald" />
                        <MetricPill label="Efficiency (10%)" value={qr.efficiency?.score} color="amber" />
                        <MetricPill label="Quality (8%)" value={qr.codeQuality?.score} color="blue" />
                        <MetricPill label="Robustness (7%)" value={qr.robustness?.score} color="indigo" />
                        <MetricPill label="Readability (5%)" value={qr.readability?.score} color="violet" />
                      </div>

                      {/* Complexity */}
                      {qr.complexity && (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-zinc-400 font-bold">Complexity:</span>
                          <span className="font-mono font-bold text-amber-400">Time: {qr.complexity.time}</span>
                          <span className="font-mono font-bold text-zinc-400">Space: {qr.complexity.space}</span>
                        </div>
                      )}

                      {/* AI Feedback */}
                      {(qr.strengths.length > 0 || qr.improvements.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {qr.strengths.length > 0 && (
                            <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-1.5">
                              <span className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider block">Strengths</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-zinc-300">
                                {qr.strengths.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                          {qr.improvements.length > 0 && (
                            <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-1.5">
                              <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider block">Improvements</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-zinc-300">
                                {qr.improvements.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Code viewer toggle */}
                      <button
                        onClick={() => setExpandedCode((prev) => ({ ...prev, [codeKey]: !prev[codeKey] }))}
                        className="w-full flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Code2 className="h-3.5 w-3.5" /> Submitted Code ({qr.language.toUpperCase()})
                        </span>
                        <span>{expandedCode[codeKey] ? "Hide ▲" : "View ▼"}</span>
                      </button>
                      {expandedCode[codeKey] && (
                        <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-64 leading-relaxed select-text">
                          <code>{qr.submittedCode || "# No code submitted"}</code>
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Not attempted message */}
                  {!isAttempted && (
                    <div className="px-5 py-3 text-xs text-zinc-500 border-t border-zinc-800/50">
                      No solution was submitted for this problem.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-zinc-800">
            <Link
              href="/candidate/assessments"
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-3 rounded-xl border border-zinc-700 transition-all text-center cursor-pointer"
            >
              Return to Assessments
            </Link>
            <Link
              href="/candidate/applications"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>View My Applications</span> <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── PRE-EXAM INSTRUCTIONS ────────────────────────────────────────────
  if (!examStarted) {
    return (
      <div className="flex items-center justify-center h-dvh bg-zinc-950 px-6 py-12 text-white font-sans">
        <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl text-left">

          {/* Title */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">Coding Assessment</span>
              <h1 className="text-xl font-extrabold text-white">{assessmentTitle}</h1>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Code2 className="h-5 w-5" />
            </div>
          </div>

          {/* Assessment Specs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3">
              <FileCode className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Problems</span>
                <span className="text-sm font-extrabold text-white">{questions.length}</span>
              </div>
            </div>
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Duration</span>
                <span className="text-sm font-extrabold text-amber-400">{durationMinutes} min</span>
              </div>
            </div>
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center gap-3">
              <Code2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Languages</span>
                <span className="text-sm font-extrabold text-emerald-400">6+</span>
              </div>
            </div>
          </div>

          {/* Before You Begin */}
          <div className="space-y-3 bg-zinc-950 p-5 rounded-xl border border-zinc-800 text-xs leading-relaxed text-zinc-300">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-blue-400" /> Before You Begin
            </h3>
            <ul className="space-y-2 list-disc pl-4 text-zinc-400">
              <li>Write code in <strong className="text-zinc-200">Python, JavaScript, C++, Java, C#, or C</strong>.</li>
              <li>Your code is <strong className="text-zinc-200">autosaved continuously</strong> as you type.</li>
              <li>Use <strong className="text-zinc-200">Run Code</strong> to test against sample inputs before submission.</li>
              <li>Navigate between problems using the <strong className="text-zinc-200">problem selector</strong> in the toolbar.</li>
              <li>Final submission evaluates solutions against hidden test cases and AI code review.</li>
              <li>Timer starts when you click Start and cannot be paused.</li>
            </ul>
          </div>

          {/* Evaluation Info */}
          <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 text-xs text-zinc-400">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider mb-2">Evaluation</h3>
            <p>Solutions are evaluated using test-case execution (70% weight) and AI code-quality analysis (30% weight). Each problem is scored independently.</p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <Link
              href="/candidate/assessments"
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-3 rounded-xl border border-zinc-700 transition-all text-center cursor-pointer"
            >
              Cancel
            </Link>
            <button
              onClick={handleStartExamSession}
              className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Coding Assessment</span> <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ACTIVE IDE ───────────────────────────────────────────────────────
  return (
    <CodingExamIDE
      questions={questions}
      durationMinutes={durationMinutes}
      onSubmit={handleSubmitCodingSolution}
    />
  );
}

// ─── Metric Pill Sub-Component ────────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: number | null | undefined; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    indigo: "text-indigo-400",
    violet: "text-violet-400",
  };

  return (
    <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-800">
      <span className="text-[9px] text-zinc-400 font-bold block">{label}</span>
      {value != null ? (
        <span className={`text-sm font-extrabold ${colorMap[color] || "text-white"}`}>{value}%</span>
      ) : (
        <span className="text-sm font-bold text-zinc-600">—</span>
      )}
    </div>
  );
}
