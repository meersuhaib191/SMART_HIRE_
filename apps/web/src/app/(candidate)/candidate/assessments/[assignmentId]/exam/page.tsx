"use client";

import * as React from "react";

import { Button } from "@smarthire/ui";
import { Loader2, ArrowLeft, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { logger } from "@smarthire/logger";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface QuestionOption {
  id: string;
  text: string;
}

interface QuestionItem {
  id: string;
  questionText: string;
  questionType: string;
  points: number;
  options: QuestionOption[];
}

export default function CandidateExamPortalPage() {
  const { assignmentId } = useParams() as { assignmentId: string };
  const supabase = createBrowserClient(REAL_URL, REAL_KEY);

  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Template and questions details
  const [title, setTitle] = React.useState("Screening Exam");
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);

  // Active attempt details
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = React.useState<string | null>(null);

  // Exam interface state
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [now, setNow] = React.useState(new Date());
  const [submitting, setSubmitting] = React.useState(false);
  const [completedAttempt, setCompletedAttempt] = React.useState<{
    score: number;
    passed: boolean;
    status: string;
  } | null>(null);

  // Live countdown timer
  React.useEffect(() => {
    if (!attemptId || completedAttempt) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [attemptId, completedAttempt]);

  // Load / initialize attempt
  React.useEffect(() => {
    const initializeAttempt = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          setErrorMsg("Unauthorized. Please log in.");
          return;
        }

        // 1. Fetch assignment details
        const { data: assignment, error: assignErr } = await supabase
          .schema("assessment")
          .from("assignments")
          .select("id, assessment_id, candidate_id, status")
          .eq("id", assignmentId)
          .single();

        if (assignErr || !assignment) {
          setErrorMsg("Screening exam assignment not found.");
          return;
        }

        // 2. Fetch assessment template details
        const { data: template } = await supabase
          .schema("assessment")
          .from("assessments")
          .select("id, title, duration_minutes")
          .eq("id", assignment.assessment_id)
          .single();

        if (template) {
          setTitle(template.title);
          setDurationMinutes(template.duration_minutes);
        }

        // 3. Fetch questions list
        const { data: dbQuestions } = await supabase
          .schema("assessment")
          .from("questions")
          .select("id, question_text, question_type, options, points")
          .eq("assessment_id", assignment.assessment_id);

        if (dbQuestions) {
          const mappedQ: QuestionItem[] = dbQuestions.map((q) => {
            let optList: QuestionOption[] = [];
            if (q.options) {
              if (Array.isArray(q.options)) {
                optList = q.options as QuestionOption[];
              } else if (typeof q.options === "string") {
                optList = JSON.parse(q.options);
              }
            }
            return {
              id: q.id,
              questionText: q.question_text,
              questionType: q.question_type,
              points: q.points || 1,
              options: optList,
            };
          });
          setQuestions(mappedQ);
        }

        // 4. Check for active or previous attempts
        const { data: existingAttempts } = await supabase
          .schema("assessment")
          .from("attempts")
          .select("id, score, passed, started_at, completed_at, status, answers")
          .eq("assignment_id", assignmentId)
          .order("started_at", { ascending: false });

        const latestAttempt = existingAttempts?.[0];

        if (latestAttempt) {
          if (latestAttempt.status === "completed" || latestAttempt.status === "timed-out" || latestAttempt.completed_at) {
            // Already finished
            setCompletedAttempt({
              score: latestAttempt.score || 0,
              passed: latestAttempt.passed || false,
              status: latestAttempt.status,
            });
            setLoading(false);
            return;
          } else {
            // Resume existing in-progress attempt
            setAttemptId(latestAttempt.id);
            setAnswers((latestAttempt.answers as Record<string, string>) || {});
            setStartedAt(latestAttempt.started_at);
            setLoading(false);
            return;
          }
        }

        // 5. Start new attempt via backend API
        const startRes = await fetch("/api/v1/assessment/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId }),
        });

        if (!startRes.ok) {
          const errData = await startRes.json();
          throw new Error(errData.message || "Failed to initiate attempt");
        }

        const { data: newAttempt } = await startRes.json();
        setAttemptId(newAttempt.id);
        setAnswers({});
        setStartedAt(newAttempt.startedAt);
      } catch (err: unknown) {
        logger.error("Failed to initialize examination attempt", err);
        setErrorMsg(err instanceof Error ? err.message : "Error loading exam.");
      } finally {
        setLoading(false);
      }
    };

    initializeAttempt();
  }, [assignmentId, supabase]);

  // Calculate remaining seconds
  const getSecondsRemaining = () => {
    if (!startedAt) return durationMinutes * 60;
    const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
    const total = durationMinutes * 60;
    return Math.max(0, total - elapsed);
  };

  const secondsRemaining = getSecondsRemaining();

  // Auto-submit on timeout
  React.useEffect(() => {
    if (attemptId && secondsRemaining === 0 && !completedAttempt && !submitting) {
      logger.info("[ExamPortal] Timer expired. Auto-submitting exam attempt...");
      handleSubmitExam();
    }
  }, [secondsRemaining, attemptId, completedAttempt, submitting]);

  // Save progress handler (optimistic & async save)
  const handleSelectOption = async (questionId: string, optionText: string) => {
    if (completedAttempt || submitting || !attemptId) return;

    const nextAnswers = { ...answers, [questionId]: optionText };
    setAnswers(nextAnswers);

    try {
      // Send progress save request to backend API
      const elapsed = startedAt ? Math.floor((new Date().getTime() - new Date(startedAt).getTime()) / 1000) : 0;
      await fetch(`/api/v1/assessment/attempts/${attemptId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: nextAnswers,
          timeSpentSeconds: elapsed,
        }),
      });
    } catch (err) {
      logger.error("Failed to save answer progress", err);
    }
  };

  // Submit and grade exam
  const handleSubmitExam = async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);

    try {
      const elapsed = startedAt ? Math.floor((new Date().getTime() - new Date(startedAt).getTime()) / 1000) : 0;
      const submitRes = await fetch(`/api/v1/assessment/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          timeSpentSeconds: elapsed,
        }),
      });

      const resData = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) {
        throw new Error(resData.message || resData.error || "Failed to submit exam");
      }

      const gradedAttempt = resData.data;
      setCompletedAttempt({
        score: gradedAttempt.score,
        passed: gradedAttempt.passed,
        status: gradedAttempt.status,
      });
    } catch (err: unknown) {
      logger.error("Failed to finalize exam attempt submission", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Submission failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Format time (HH:MM:SS)
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7]">
        <Loader2 className="h-9 w-9 animate-spin text-[#0071E3]" />
        <p className="text-[12px] text-zinc-500 font-bold mt-4 animate-pulse">Initializing Exam Session...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7] px-6 text-center">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full border border-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900">Session Error</h3>
        <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed font-semibold">{errorMsg}</p>
        <Link href="/candidate/assessments" className="mt-6">
          <Button variant="outline" className="border-[#D2D2D7] rounded-xl text-xs font-bold px-5 h-9.5">
            Return to Assessments
          </Button>
        </Link>
      </div>
    );
  }

  if (completedAttempt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7] px-6 py-12 animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white border border-[#D2D2D7] rounded-[24px] shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-zinc-900">Examination Submitted!</h2>
            <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
              Your screening assessment has been successfully graded and recorded in our recruiter tracking system.
            </p>
          </div>

          <div className="bg-[#F5F5F7] border border-[#E8E8ED] rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center text-left">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Exam Title:</span>
              <span className="text-[12px] font-bold text-zinc-900">{title}</span>
            </div>
            <div className="flex justify-between items-center text-left">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Obtained Score:</span>
              <span className="text-[14px] font-mono font-bold text-zinc-900">{completedAttempt.score}%</span>
            </div>
            <div className="flex justify-between items-center text-left">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status:</span>
              <span className={`text-[12px] font-bold uppercase tracking-wider ${completedAttempt.passed ? "text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100" : "text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100"}`}>
                {completedAttempt.passed ? "Passed" : "Completed / Graded"}
              </span>
            </div>
          </div>

          <Link href="/candidate/assessments" className="block pt-2">
            <Button className="w-full bg-[#0071E3] hover:bg-[#0051A3] text-white text-xs font-bold h-10 rounded-xl transition-colors cursor-pointer">
              Go to Candidate Portal
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[activeIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col justify-between text-left">
      {/* Header bar */}
      <header className="bg-white border-b border-[#D2D2D7] h-16 flex items-center justify-between px-6 sticky top-0 z-40 select-none">
        <div className="flex items-center gap-4">
          <Link href="/candidate/assessments">
            <button className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer">
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 leading-snug">{title}</h1>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">MCQ SCREENING TEST</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Progress Indicator */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
              <div
                className="bg-[#0071E3] h-full transition-all duration-300"
                style={{ width: `${(answeredCount / Math.max(1, totalQuestions)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase tabular-nums">
              {answeredCount}/{totalQuestions} Answered
            </span>
          </div>

          {/* Countdown Clock */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-[13px] tabular-nums ${secondsRemaining < 300 ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-zinc-50 text-zinc-850 border-zinc-200"}`}>
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex max-w-6xl w-full mx-auto p-6 gap-6 items-start overflow-hidden">
        {/* Left Sidebar (Questions Numbers Grid) */}
        <section className="w-64 bg-white border border-[#D2D2D7] rounded-2xl p-4 shrink-0 space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto hidden md:block">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Questions Index
          </div>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isActive = activeIndex === idx;

              return (
                <button
                  key={q.id}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-9 w-9 rounded-lg text-xs font-bold border transition-all flex items-center justify-center cursor-pointer ${isActive ? "bg-[#0071E3] border-[#0071E3] text-white" : isAnswered ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-zinc-100 space-y-2 text-[10px] font-semibold text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#0071E3] rounded-sm" /> Active Item
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-50 border border-emerald-200 rounded-sm" /> Answered
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-zinc-50 border border-zinc-200 rounded-sm" /> Unanswered
            </div>
          </div>
        </section>

        {/* Center Panel (Active Question Container) */}
        {activeQuestion ? (
          <section className="flex-grow flex flex-col gap-6">
            <div className="bg-white border border-[#D2D2D7] rounded-[24px] p-6.5 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                  Question {activeIndex + 1} of {totalQuestions}
                </span>
                <span className="text-[10px] font-bold text-[#0071E3] uppercase tracking-wider bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                  {activeQuestion.points} Points
                </span>
              </div>

              <h2 className="text-base font-bold text-zinc-950 leading-relaxed font-sans">
                {activeQuestion.questionText}
              </h2>

              {/* Options Selection Cards */}
              <div className="space-y-3.5 pt-2">
                {activeQuestion.options.map((opt) => {
                  const isSelected = answers[activeQuestion.id] === opt.text;

                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(activeQuestion.id, opt.text)}
                      className={`w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer group shadow-sm ${isSelected ? "border-[#0071E3] bg-blue-50/15" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "border-[#0071E3] bg-[#0071E3]" : "border-zinc-300 group-hover:border-zinc-400"}`}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <span className={`text-xs font-bold leading-relaxed transition-colors ${isSelected ? "text-zinc-900" : "text-zinc-700 group-hover:text-zinc-900"}`}>
                          {opt.text}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Button Controls */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex(activeIndex - 1)}
                className="border-[#D2D2D7] hover:bg-[#F2F2F2] rounded-xl text-xs font-bold px-4 h-9.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous Question
              </Button>

              <div className="flex items-center gap-3">
                {activeIndex < totalQuestions - 1 ? (
                  <Button
                    onClick={() => setActiveIndex(activeIndex + 1)}
                    className="bg-[#0071E3] hover:bg-[#0051A3] text-white text-xs font-bold px-5 h-9.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Next Question
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitExam}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 h-9.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit Examination"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="flex-grow bg-white border border-[#D2D2D7] rounded-[24px] p-12 text-center text-zinc-500 italic text-sm">
            No questions available for this assessment template.
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="bg-white border-t border-[#D2D2D7] h-14 flex items-center justify-between px-6 text-[10px] text-zinc-500 font-semibold select-none">
        <span>SMART HIRE SECURE ASSESSMENTS BROWSER PANEL</span>
        <span>ANSWERS PROGRESS SAVED AUTOMATICALLY</span>
      </footer>
    </div>
  );
}
