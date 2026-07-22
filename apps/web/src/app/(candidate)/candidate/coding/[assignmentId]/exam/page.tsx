"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { CodingExamIDE, CodingQuestion } from "@/components/coding/CodingExamIDE";
import { Loader2, Clock, Trophy, ArrowRight } from "lucide-react";
import { logger } from "@smarthire/logger";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const MOCK_CODING_QUESTION: CodingQuestion = {
  id: "q-101",
  title: "Two Sum & Target Pair Finder",
  difficulty: "medium",
  category: "Data Structures & Algorithms",
  description: `Given an array of integers \`nums\` and an integer \`target\`, return the indices or values of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Write an efficient algorithm to process the input string and return the result formatted as expected.`,
  inputFormat: "First line contains array elements separated by space. Second line contains target integer.",
  outputFormat: "Return the two elements or indices separated by space.",
  constraints: "2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9",
  testCases: [
    {
      id: "tc-1",
      input: "2 7 11 15\n9",
      expectedOutput: "2 7",
      explanation: "2 + 7 = 9, so target sum is reached.",
      isSample: true,
    },
    {
      id: "tc-2",
      input: "3 2 4\n6",
      expectedOutput: "2 4",
      explanation: "2 + 4 = 6.",
      isSample: true,
    },
    {
      id: "tc-3",
      input: "3 3\n6",
      expectedOutput: "3 3",
      explanation: "3 + 3 = 6.",
      isSample: true,
    },
  ],
  starterCode: {
    python: `# Complete the function below
def solve(input_data: str) -> str:
    lines = input_data.strip().split('\\n')
    if len(lines) < 2:
        return "2 7"
    nums = list(map(int, lines[0].split()))
    target = int(lines[1].strip())
    
    seen = {}
    for num in nums:
        diff = target - num
        if diff in seen:
            return f"{diff} {num}"
        seen[num] = True
    return ""`
  }
};

export default function CandidateCodingExamPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  const [loading, setLoading] = React.useState(true);
  const [scheduledStartTime, setScheduledStartTime] = React.useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = React.useState<number>(60);
  const [question, setQuestion] = React.useState<CodingQuestion>(MOCK_CODING_QUESTION);
  const [now, setNow] = React.useState(new Date());
  
  // Submission completion modal state
  const [resultModal, setResultModal] = React.useState<{
    score10: number;
    passed: boolean;
    breakdown: { correctness: string; codeQuality: string; timeEfficiency: string };
  } | null>(null);

  const supabase = createBrowserClient(REAL_URL, REAL_KEY);

  // Live countdown timer check for scheduled start
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const loadAssignmentDetails = async () => {
      try {
        const { data: assignment, error: assignErr } = await supabase
          .schema("assessment")
          .from("assignments")
          .select("id, assessment_id, scheduled_start_at, status")
          .eq("id", assignmentId)
          .single();

        if (assignErr || !assignment) {
          logger.error("Failed to load assignment details", assignErr);
          return;
        }

        if (assignment.scheduled_start_at) {
          setScheduledStartTime(new Date(assignment.scheduled_start_at));
        }

        // Load assessment template
        const { data: tmpl } = await supabase
          .schema("assessment")
          .from("assessments")
          .select("title, duration_minutes")
          .eq("id", assignment.assessment_id)
          .single();

        if (tmpl?.duration_minutes) {
          setDurationMinutes(tmpl.duration_minutes);
        }

        // Fetch question details if questions exist
        const { data: questions } = await supabase
          .schema("assessment")
          .from("questions")
          .select("*")
          .eq("assessment_id", assignment.assessment_id);

        if (questions && questions.length > 0) {
          const firstCoding = questions.find((q) => q.question_type === "coding") || questions[0];
          setQuestion({
            id: firstCoding.id,
            title: tmpl?.title || firstCoding.question_text || "Coding Interview Assessment",
            difficulty: (firstCoding.difficulty as "easy" | "medium" | "hard") || "medium",
            category: firstCoding.category || "Algorithms",
            description: firstCoding.question_text || MOCK_CODING_QUESTION.description,
            inputFormat: firstCoding.section || MOCK_CODING_QUESTION.inputFormat,
            outputFormat: MOCK_CODING_QUESTION.outputFormat,
            constraints: MOCK_CODING_QUESTION.constraints,
            testCases: firstCoding.options && Array.isArray(firstCoding.options) && firstCoding.options.length > 0
              ? firstCoding.options
              : MOCK_CODING_QUESTION.testCases,
            starterCode: MOCK_CODING_QUESTION.starterCode,
          });
        }
      } catch (err) {
        logger.error("Error loading candidate coding exam", err);
      } finally {
        setLoading(false);
      }
    };

    loadAssignmentDetails();
  }, [assignmentId, supabase]);

  const handleSubmitExam = async (submission: { code: string; language: string; timeSpentSeconds: number }) => {
    try {
      const res = await fetch("/api/candidate/coding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          code: submission.code,
          language: submission.language,
          timeSpentSeconds: submission.timeSpentSeconds,
          testCases: question.testCases,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setResultModal({
        score10: data.score10,
        passed: data.passed,
        breakdown: data.breakdown,
      });
    } catch (err: unknown) {
      logger.error("Coding submission error", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Submission failed: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1e1e1e] text-zinc-100 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-xs font-mono text-zinc-400">Loading Built-in IDE Environment...</p>
      </div>
    );
  }

  // If scheduled in the future, show countdown waiting screen
  if (scheduledStartTime && scheduledStartTime > now) {
    const diffMs = scheduledStartTime.getTime() - now.getTime();
    const secs = Math.floor((diffMs / 1000) % 60);
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    const hrs = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return (
      <div className="min-h-screen bg-[#181818] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#252526] border border-zinc-700/80 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-zinc-100">{question.title}</h1>
            <p className="text-xs text-zinc-400">Coding Interview Assessment Round</p>
          </div>

          <div className="bg-[#181818] p-4 rounded-xl border border-zinc-700 space-y-1 font-mono">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Exam Starts In</span>
            <div className="text-2xl font-extrabold text-white">
              {days > 0 ? `${days}d ` : ""}{hrs}h {mins}m {secs}s
            </div>
            <p className="text-[11px] text-zinc-400 pt-1">Scheduled for: {scheduledStartTime.toLocaleString()}</p>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Please keep this tab open. Your built-in IDE environment will activate automatically when the scheduled exam time arrives.
          </p>

          <Link href="/candidate/assessments" className="block">
            <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold py-2.5 rounded-xl border border-zinc-700 transition-colors">
              Return to Candidate Portal
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <CodingExamIDE
        question={question}
        durationMinutes={durationMinutes}
        onSubmit={handleSubmitExam}
      />

      {/* Result & Evaluation Summary Modal */}
      {resultModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-[#1e1e1e] border border-zinc-700 rounded-2xl p-6 space-y-5 text-center text-zinc-100 shadow-2xl scale-in-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${
              resultModal.passed ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}>
              <Trophy className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-100">Coding Interview Submitted</h2>
              <p className="text-xs text-zinc-400">Automated 10-Point Score Calculation Completed</p>
            </div>

            {/* Score Display Card */}
            <div className="bg-[#141414] p-5 rounded-xl border border-zinc-800 space-y-3 font-mono">
              <div className="flex justify-between items-baseline border-b border-zinc-800 pb-3">
                <span className="text-xs font-sans text-zinc-400">Total Awarded Score:</span>
                <span className="text-3xl font-extrabold text-emerald-400">{resultModal.score10} <span className="text-sm text-zinc-400 font-normal">/ 10</span></span>
              </div>

              <div className="space-y-2 text-xs font-sans text-left text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Test Case Correctness:</span>
                  <span className="font-bold text-white">{resultModal.breakdown.correctness}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Code Quality & Edge Cases:</span>
                  <span className="font-bold text-white">{resultModal.breakdown.codeQuality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Time Efficiency Factor:</span>
                  <span className="font-bold text-white">{resultModal.breakdown.timeEfficiency}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push("/candidate/assessments")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              Back to Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
