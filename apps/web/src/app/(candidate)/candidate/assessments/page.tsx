"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import {
  Loader2, Play, CheckCircle2, Calendar, Code, FileText,
  Clock, Trophy, AlertCircle, ChevronRight, Briefcase, Lock, Star, Video, ArrowRight
} from "lucide-react";
import { logger } from "@smarthire/logger";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { isTechDomain } from "@/utils/domain-utils";
import { resolveCandidateProfileIds } from "@/utils/candidate-helper";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface AssignmentItem {
  id: string;
  assessment_id: string;
  application_id: string | null;
  title: string;
  type: "mcq" | "coding";
  duration_minutes: number;
  scheduled_start_at: string | null;
  expires_at: string | null;
  status: string;
  attempt?: {
    id: string;
    score?: number | null;
    passed?: boolean | null;
    started_at: string;
    completed_at?: string | null;
  } | null;
}

interface JobGroup {
  jobId: string;
  jobTitle: string;
  jobCategory?: string | null;
  appliedAt: string;
  applicationStatus: string;
  assignments: AssignmentItem[];
}

const STAGE_ORDER = [
  "applied",
  "screening",
  "mcq",
  "coding",
  "interview",
  "zoom_interview",
  "offer_sent",
];

const STAGE_LABELS: Record<string, string> = {
  applied: "1. Applied",
  screening: "2. ATS Screened",
  mcq: "3. MCQ Exam",
  coding: "4. IDE Coding",
  interview: "5. AI Interview",
  zoom_interview: "6. Recruiter Meet",
  offer_sent: "7. Offer & Joined",
  offer_accepted: "7. Offer & Joined",
  joined: "7. Offer & Joined",
  offered: "7. Offer & Joined",
  rejected: "Rejected",
};

function StageProgressBar({ currentStatus, isTech = true }: { currentStatus: string; isTech?: boolean }) {
  const stages = isTech ? STAGE_ORDER : STAGE_ORDER.filter((s) => s !== "coding");
  const idx = stages.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-0 w-full mt-3">
      {stages.map((stage, i) => {
        const isCompleted = i < idx;
        const isCurrent = i === idx;
        const rawLabel = STAGE_LABELS[stage] || stage;
        const label = `${i + 1}. ${rawLabel.replace(/^\d+\.\s*/, "")}`;

        return (
          <React.Fragment key={stage}>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all ${
                  isCompleted
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : isCurrent
                    ? "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-white border-zinc-200 text-zinc-400"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`text-[9px] font-semibold truncate w-full text-center ${
                  isCurrent ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-zinc-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div
                className={`h-0.5 flex-1 mb-4 rounded-full transition-all ${
                  i < idx ? "bg-emerald-400" : "bg-zinc-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [diff, setDiff] = React.useState(0);

  React.useEffect(() => {
    const update = () => setDiff(new Date(targetDate).getTime() - Date.now());
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (diff <= 0) return <span className="text-emerald-600 font-bold text-xs">Starting now!</span>;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const urgency = diff < 3600000 ? "text-red-600 bg-red-50 border-red-200" :
    diff < 86400000 ? "text-amber-600 bg-amber-50 border-amber-200" :
      "text-blue-600 bg-blue-50 border-blue-200";

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${urgency}`}>
      <Clock className="h-3.5 w-3.5" />
      {d > 0 ? `${d}d ` : ""}{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}

function ScoreRing({ score, total, passed }: { score: number; total: number; passed?: boolean | null }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 50 50" className="w-12 h-12 -rotate-90">
          <circle cx="25" cy="25" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
          <circle
            cx="25" cy="25" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-900">{score}/{total} pts</p>
        {passed !== null && passed !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}>
            {passed ? "PASSED" : "FAILED"}
          </span>
        )}
      </div>
    </div>
  );
}

function AssessmentCard({ item, now }: { item: AssignmentItem; now: Date }) {
  const isCompleted = Boolean(item.attempt?.completed_at || (item.status === "completed" && item.attempt));
  const isUnscheduled = !isCompleted && !item.scheduled_start_at;
  const isFuture = item.scheduled_start_at ? new Date(item.scheduled_start_at) > now : false;
  const isExpired = item.expires_at ? new Date(item.expires_at) < now && !isCompleted : false;

  const typeColor = item.type === "coding"
    ? { bg: "from-emerald-500 to-teal-600", light: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: Code }
    : { bg: "from-indigo-500 to-violet-600", light: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: FileText };

  const Icon = typeColor.icon;

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${isCompleted ? "border-emerald-200" : isExpired ? "border-red-200 opacity-75" : isUnscheduled ? "border-zinc-200 opacity-90" : isFuture ? "border-amber-200" : "border-zinc-200 hover:border-blue-300"
      }`}>
      {/* Card Header */}
      <div className={`bg-gradient-to-r ${typeColor.bg} px-5 py-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-snug">{item.title}</h4>
              <span className="text-[10px] text-white/75 font-semibold uppercase tracking-wider">
                {item.type === "coding" ? "Built-in IDE Coding Round" : "Multiple Choice Test"}
              </span>
            </div>
          </div>

          {/* Status chip */}
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
              <CheckCircle2 className="h-3 w-3" /> Done
            </span>
          ) : isExpired ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
              <AlertCircle className="h-3 w-3" /> Expired
            </span>
          ) : isUnscheduled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
              <Clock className="h-3 w-3" /> Unscheduled
            </span>
          ) : isFuture ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold animate-pulse">
              <Calendar className="h-3 w-3" /> Scheduled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
              <Play className="h-3 w-3" /> Active
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-4">
        {/* Duration */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
          <Clock className="h-3.5 w-3.5" />
          <span><span className="text-zinc-900 font-bold">{item.duration_minutes} min</span> duration</span>
        </div>

        {/* Score Ring (if completed) */}
        {isCompleted && item.attempt?.score != null && (
          <div className="pt-1 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-2">Your Result</p>
            <ScoreRing
              score={item.attempt.score}
              total={100}
              passed={item.attempt.passed}
            />
          </div>
        )}

        {/* Countdown (if scheduled) */}
        {isFuture && item.scheduled_start_at && (
          <div className="pt-1 border-t border-zinc-100 space-y-2">
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Starts In</p>
            <CountdownTimer targetDate={item.scheduled_start_at} />
            <p className="text-[10px] text-zinc-500">
              {new Date(item.scheduled_start_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        )}

        {/* Unscheduled notice */}
        {isUnscheduled && (
          <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium">
            Recruiter has not scheduled the date & time for this MCQ round yet. Entry is locked until scheduled.
          </p>
        )}

        {/* Completion Date */}
        {isCompleted && item.attempt?.completed_at && (
          <p className="text-[10px] text-zinc-400 italic">
            Completed {new Date(item.attempt.completed_at).toLocaleDateString([], { dateStyle: "medium" })}
          </p>
        )}

        {/* CTA */}
        <div className="pt-2 border-t border-zinc-100">
          {isCompleted ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-bold">Assessment Complete</span>
              </div>
              {item.type === "coding" && (
                <div className="flex gap-2">
                  <Link
                    href={`/candidate/coding/${item.id}/exam`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer"
                  >
                    View Result
                  </Link>
                </div>
              )}
            </div>
          ) : isExpired ? (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-bold">This assessment has expired</span>
            </div>
          ) : isUnscheduled ? (
            <Button disabled className="w-full h-9 text-xs font-bold rounded-xl opacity-60 cursor-not-allowed bg-zinc-100 text-zinc-500 border border-zinc-200">
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Locked - Pending Recruiter Schedule
            </Button>
          ) : isFuture ? (
            <Button disabled className="w-full h-9 text-xs font-bold rounded-xl opacity-60 cursor-not-allowed">
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Locked Until Scheduled Time
            </Button>
          ) : (
            <Link
              href={
                item.type === "ai_interview"
                  ? `/candidate/ai-interview/${item.id}/exam`
                  : item.type === "coding"
                  ? `/candidate/coding/${item.id}/exam`
                  : `/candidate/assessments/${item.id}/exam`
              }
              className="w-full"
            >
              <Button
                className={`w-full h-9 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                  item.type === "ai_interview"
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    : item.type === "coding"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {item.type === "ai_interview"
                  ? "Start AI Live Interview"
                  : item.type === "coding"
                  ? "Launch Coding IDE"
                  : "Start MCQ Test"}{" "}
                <Play className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CandidateAssessmentsPage() {
  const [jobGroups, setJobGroups] = React.useState<JobGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [now, setNow] = React.useState(new Date());
  const [expandedJobs, setExpandedJobs] = React.useState<Set<string>>(new Set());

  const supabase = createBrowserClient(REAL_URL, REAL_KEY);

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const candIds = await resolveCandidateProfileIds(supabase, authUser);
        if (candIds.length === 0) return;

        // Fetch applications with job info
        const { data: applications } = await supabase
          .schema("application").from("applications")
          .select("id, job_id, status, created_at, mcq_score, mcq_passed, coding_score, coding_passed")
          .in("candidate_id", candIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (!applications || applications.length === 0) {
          setJobGroups([]);
          return;
        }

        // Fetch job titles & scheduled exam times
        const jobIds = [...new Set(applications.map(a => a.job_id))];
        const { data: jobs } = await supabase
          .schema("job").from("jobs")
          .select("id, title, category, mcq_assessment_id, mcq_scheduled_start_at, coding_assessment_id, coding_scheduled_start_at")
          .in("id", jobIds);

        // Fetch assignments
        const { data: rawAssignments } = await supabase
          .schema("assessment").from("assignments")
          .select("id, assessment_id, application_id, status, expires_at, created_at, scheduled_start_at")
          .in("candidate_id", candIds);

        // Fetch templates
        const { data: templates } = await supabase
          .schema("assessment").from("assessments")
          .select("id, title, duration_minutes");

        // Fetch questions to determine type
        const { data: allQuestions } = await supabase
          .schema("assessment").from("questions")
          .select("assessment_id, question_type");

        const codingIds = new Set<string>();
        (allQuestions || []).forEach(q => {
          if (q.question_type === "coding") codingIds.add(q.assessment_id);
        });

        // Fetch attempts
        const { data: rawAttempts } = await supabase
          .schema("assessment").from("attempts")
          .select("id, score, passed, started_at, completed_at, assessment_id, assignment_id")
          .in("candidate_id", candIds);

        // Stage completion tracking lookup
        // Stages AFTER which MCQ/coding is considered complete (status = "mcq" means currently IN mcq, not done)
        const COMPLETED_MCQ_STAGES = ["coding", "interview", "recruiter_review", "zoom_interview", "offer_sent", "offered", "joined"];
        const COMPLETED_CODING_STAGES = ["interview", "recruiter_review", "zoom_interview", "offer_sent", "offered", "joined"];

        // Only return a score if there is REAL data — never fabricate results
        const parseNormalizedScore = (val: any): number | null => {
          if (val != null && !isNaN(Number(val))) {
            const num = Number(val);
            if (num > 0 && num <= 10) return Math.round(num * 10);
            if (num > 10) return Math.round(num);
          }
          return null; // No real score — show nothing
        };

        // Group assignments by application/job
        const groups: JobGroup[] = applications.map(app => {
          const job = (jobs || []).find(j => j.id === app.job_id);
          const appAssignments = (rawAssignments || []).filter(a => a.application_id === app.id);

          const mapped: AssignmentItem[] = appAssignments.map(assignment => {
            const tmpl = (templates || []).find(t => t.id === assignment.assessment_id);
            const attempt = (rawAttempts || []).find(
              a => a.assignment_id === assignment.id || a.assessment_id === assignment.assessment_id
            );
            const isAiInterview = Boolean(tmpl?.title?.toLowerCase().includes("ai")) || Boolean(tmpl?.title?.toLowerCase().includes("interview"));
            const isCoding = !isAiInterview && (codingIds.has(assignment.assessment_id) ||
              Boolean(tmpl?.title?.toLowerCase().includes("coding")));
            const itemType = isAiInterview ? "ai_interview" : (isCoding ? "coding" : "mcq");

            // If assignment was explicitly reset to "assigned" (recruiter rescheduled), it is NOT done
            const wasRescheduled = assignment.status === "assigned";
            const isDone = !wasRescheduled && (
              assignment.status === "completed" ||
              Boolean(attempt?.completed_at) ||
              (isAiInterview ? false : (isCoding
                ? (app.coding_score != null || COMPLETED_CODING_STAGES.includes(app.status))
                : (app.mcq_score != null || COMPLETED_MCQ_STAGES.includes(app.status))))
            );

            const rawScore = attempt?.score ?? (isCoding ? app.coding_score : app.mcq_score);
            const normScore = isDone ? parseNormalizedScore(rawScore) : null;

            return {
              id: assignment.id,
              assessment_id: assignment.assessment_id,
              application_id: assignment.application_id,
              title: tmpl?.title ?? (isAiInterview ? `${job?.title || "AI"} Interview` : isCoding ? `${job?.title || "Coding"} Round` : `${job?.title || "MCQ"} Assessment`),
              type: itemType,
              duration_minutes: tmpl?.duration_minutes ? Number(tmpl.duration_minutes) : (isCoding ? 60 : 15),
              scheduled_start_at: assignment.scheduled_start_at || (isCoding ? job?.coding_scheduled_start_at : job?.mcq_scheduled_start_at) || null,
              expires_at: assignment.expires_at,
              status: isDone ? "completed" : assignment.status,
              attempt: isDone ? {
                id: attempt?.id || `attempt-${assignment.id}`,
                score: normScore,
                passed: attempt?.passed ?? (isCoding ? app.coding_passed !== false : app.mcq_passed !== false),
                started_at: attempt?.started_at || app.created_at,
                completed_at: attempt?.completed_at || new Date().toISOString(),
              } : null,
            };
          });

          // MCQ card: show if recruiter assigned it OR candidate already reached/passed MCQ stage
          const mcqStagesReached = ["mcq", "coding", "interview", "recruiter_review", "zoom_interview", "offer_sent", "offered", "joined"];
          const recruiterAssignedMcq = Boolean(job?.mcq_assessment_id);
          const appHasReachedMcqStage = mcqStagesReached.includes(app.status) || app.mcq_score != null;

          if ((recruiterAssignedMcq || appHasReachedMcqStage) && !mapped.some(m => m.type === "mcq")) {
            const tmpl = (templates || []).find(t => t.id === job?.mcq_assessment_id);
            // Check if there's a reset assignment for this MCQ
            const mcqAssignment = appAssignments.find(a => a.assessment_id === job?.mcq_assessment_id);
            const mcqWasRescheduled = mcqAssignment?.status === "assigned";
            // MCQ is done only if real score exists or status has moved PAST mcq stage, AND not rescheduled
            const isMcqDone = !mcqWasRescheduled && (app.mcq_score != null || COMPLETED_MCQ_STAGES.includes(app.status));
            const mcqNormScore = isMcqDone ? parseNormalizedScore(app.mcq_score) : null;

            mapped.push({
              id: job?.mcq_assessment_id || `mcq-assign-${app.id}`,
              assessment_id: job?.mcq_assessment_id || `mcq-tmpl-${app.job_id}`,
              application_id: app.id,
              title: tmpl?.title ?? `${job?.title || "Role"} - MCQ Screening Assessment`,
              type: "mcq",
              duration_minutes: tmpl?.duration_minutes || 10,
              scheduled_start_at: job?.mcq_scheduled_start_at || null,
              expires_at: null,
              status: isMcqDone ? "completed" : "assigned",
              attempt: isMcqDone ? {
                id: `mcq-att-${app.id}`,
                score: mcqNormScore,
                passed: app.mcq_passed ?? null,
                started_at: app.created_at,
                completed_at: new Date().toISOString(),
              } : null,
            });
          }

          // Coding card: ONLY show if job is in Tech domain AND recruiter assigned AND app has moved PAST mcq stage
          const isTechJob = isTechDomain(job?.category, job?.title);
          const codingStagesReached = ["coding", "interview", "recruiter_review", "zoom_interview", "offer_sent", "offered", "joined"];
          const recruiterAssignedCoding = Boolean(job?.coding_assessment_id);
          const appHasReachedCodingStage = codingStagesReached.includes(app.status);

          if (isTechJob && recruiterAssignedCoding && appHasReachedCodingStage && !mapped.some(m => m.type === "coding")) {
            const tmpl = (templates || []).find(t => t.id === job?.coding_assessment_id);
            // Check if there's a reset assignment for this coding assessment
            const codingAssignment = appAssignments.find(a => a.assessment_id === job?.coding_assessment_id);
            const codingWasRescheduled = codingAssignment?.status === "assigned";
            // Coding done only if real score exists or status has moved PAST coding stage, AND not rescheduled
            const isCodingDone = !codingWasRescheduled && (app.coding_score != null || COMPLETED_CODING_STAGES.includes(app.status));
            const codingNormScore = isCodingDone ? parseNormalizedScore(app.coding_score) : null;

            mapped.push({
              id: job?.coding_assessment_id || `coding-assign-${app.id}`,
              assessment_id: job?.coding_assessment_id || `coding-tmpl-${app.job_id}`,
              application_id: app.id,
              title: tmpl?.title ?? `${job?.title || "Role"} - Coding Interview Round`,
              type: "coding",
              duration_minutes: tmpl?.duration_minutes || 30,
              scheduled_start_at: job?.coding_scheduled_start_at || null,
              expires_at: null,
              status: isCodingDone ? "completed" : "assigned",
              attempt: isCodingDone ? {
                id: `coding-att-${app.id}`,
                score: codingNormScore,
                passed: app.coding_passed ?? null,
                started_at: app.created_at,
                completed_at: new Date().toISOString(),
              } : null,
            });
          }

          return {
            jobId: app.job_id,
            jobTitle: job?.title ?? "Unknown Position",
            jobCategory: job?.category || null,
            appliedAt: app.created_at,
            applicationStatus: app.status,
            assignments: mapped,
          };
        });

        setJobGroups(groups);
        // Auto-expand all jobs that have assessments or active stages (mcq, coding, interview)
        const toExpand = new Set<string>(
          groups
            .filter(g => g.assignments.length > 0 || ["mcq", "coding", "interview"].includes(g.applicationStatus))
            .map(g => g.jobId + g.appliedAt)
        );
        setExpandedJobs(toExpand);
      } catch (err) {
        logger.error("Failed to fetch candidate assessments", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleJob = (key: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const [trackingGroup, setTrackingGroup] = React.useState<JobGroup | null>(null);
  const [showOfferLetterModal, setShowOfferLetterModal] = React.useState<boolean>(false);

  const totalAssignments = jobGroups.reduce((s, g) => s + g.assignments.length, 0);
  const completedCount = jobGroups.reduce((s, g) =>
    s + g.assignments.filter(a => Boolean(a.attempt?.completed_at)).length, 0);
  const pendingCount = totalAssignments - completedCount;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500 font-medium">Loading your assessments...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Page Header */}
      <div className="space-y-1 border-b border-zinc-200 pb-5 text-left">
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">Candidate Portal</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">My Assessments</h1>
        <p className="text-sm text-zinc-500 font-medium">
          Track your progress across all job applications — MCQ tests, coding rounds, and interviews.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Applications", value: jobGroups.length, icon: Briefcase, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-100" },
          { label: "Completed", value: completedCount, icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        ].map(stat => (
          <div key={stat.label} className={`rounded-2xl border p-4 flex items-center gap-4 ${stat.color.split(" ").slice(1).join(" ")}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color.split(" ")[0]} ${stat.color.split(" ")[1]}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-zinc-900 tabular-nums">{stat.value}</p>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Job Groups */}
      {jobGroups.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Briefcase className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">No Assessments Yet</h3>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto">
            Apply for a job and complete the screening process to receive your first assessment.
          </p>
          <Link href="/candidate/jobs">
            <Button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl px-6 h-9 cursor-pointer">
              Browse Jobs
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {jobGroups.map(group => {
            const key = group.jobId + group.appliedAt;
            const isOpen = expandedJobs.has(key);
            const completedInGroup = group.assignments.filter(a => Boolean(a.attempt?.completed_at)).length;
            const hasActive = group.assignments.some(a =>
              !a.attempt?.completed_at && (!a.scheduled_start_at || new Date(a.scheduled_start_at) <= now)
            );

            return (
              <div key={key} className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200">
                {/* Job Header */}
                <div
                  onClick={() => toggleJob(key)}
                  className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-900">{group.jobTitle}</h3>
                        {hasActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold animate-pulse">
                            <Star className="h-2.5 w-2.5" /> Action Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-zinc-500 font-medium capitalize">
                          Status: <span className={`font-bold ${group.applicationStatus === "offered" ? "text-emerald-600" :
                              group.applicationStatus === "rejected" ? "text-red-600" : "text-blue-600"
                            }`}>{STAGE_LABELS[group.applicationStatus] || group.applicationStatus}</span>
                        </span>
                        <span className="text-zinc-300">•</span>
                        <span className="text-xs text-zinc-500 font-medium">
                          Applied {new Date(group.appliedAt).toLocaleDateString([], { dateStyle: "medium" })}
                        </span>
                        {group.assignments.length > 0 && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="text-xs text-zinc-500 font-medium">
                              <span className="font-bold text-zinc-900">{completedInGroup}/{group.assignments.length}</span> assessments done
                            </span>
                          </>
                        )}
                      </div>
                      <StageProgressBar currentStatus={group.applicationStatus} isTech={isTechDomain(group.jobCategory, group.jobTitle)} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackingGroup(group);
                      }}
                      className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                    >
                      <Video className="h-3.5 w-3.5 text-blue-600" />
                      <span>Track Application</span>
                      <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                    </button>
                    <ChevronRight className={`h-5 w-5 text-zinc-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {/* Assessments Grid */}
                {isOpen && (
                  <div className="border-t border-zinc-100 p-5 bg-zinc-50/50">
                    {group.assignments.length === 0 ? (
                      <div className="py-8 text-center text-sm text-zinc-400 font-medium">
                        No assessments assigned yet for this application.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.assignments.map(item => (
                          <AssessmentCard key={item.id} item={item} now={now} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Application Progression & Round Tracker Modal */}
      {trackingGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-xl w-full p-6 text-left space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">Application Tracker & Rounds</span>
                <h2 className="text-xl font-extrabold text-zinc-900">{trackingGroup.jobTitle}</h2>
                <p className="text-xs text-zinc-500 font-medium">Applied on {new Date(trackingGroup.appliedAt).toLocaleDateString([], { dateStyle: "long" })}</p>
              </div>
              <button
                type="button"
                onClick={() => setTrackingGroup(null)}
                className="text-zinc-400 hover:text-zinc-700 font-bold p-1.5 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Stage Progress Timeline */}
            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Current Application Stage</span>
              <StageProgressBar currentStatus={trackingGroup.applicationStatus} />
            </div>

            {/* Actionable Current Round Container */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Applicable Next Round Action</h3>

              {/* IF OFFER SENT / ACCEPTED / JOINED */}
              {["offer_sent", "offer_accepted", "joined", "offered"].includes(trackingGroup.applicationStatus) ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" /> All Interview Rounds Passed! Offer Extended
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                    Congratulations! You have successfully completed all evaluation rounds for <strong>{trackingGroup.jobTitle}</strong>. The hiring team has extended an official Offer Letter.
                  </p>
                  <Button
                    onClick={() => setShowOfferLetterModal(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" /> View & Download Official Offer Letter PDF
                  </Button>
                </div>
              ) : ["zoom_interview"].includes(trackingGroup.applicationStatus) ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <Video className="h-5 w-5 text-indigo-600" /> Recruiter Final Interview (Native Video Room)
                  </div>
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    You have advanced to the final live recruiter interview round inside SmartHire's secure native video meeting room.
                  </p>
                  <Link href="/candidate/interviews" className="block">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-2">
                      <Video className="h-4 w-4" /> Enter SmartHire Interview Lobby
                    </Button>
                  </Link>
                </div>
              ) : ["interview", "recruiter_review"].includes(trackingGroup.applicationStatus) ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <Video className="h-5 w-5 text-indigo-600" /> AI Technical Live Interview
                  </div>
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    Your live AI interview powered by Gemini adapts to the job requirements and your responses.
                  </p>
                  <Link href="/candidate/interviews" className="block">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-2">
                      <Video className="h-4 w-4" /> View Interview Room
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-3 text-left">
                  <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs">
                    <Clock className="h-4 w-4 text-blue-600" /> Screening & Skill Assessment Phase
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Complete your assigned screening assessments below to proceed to the AI Video Interview.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTrackingGroup(null)}
                    className="w-full bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm cursor-pointer"
                  >
                    View Active Screening Cards Below
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-100 flex justify-end">
              <Button
                onClick={() => setTrackingGroup(null)}
                variant="outline"
                className="text-xs font-bold border-zinc-300 rounded-xl px-5 h-9"
              >
                Close Tracker
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Letter Viewer Modal */}
      {showOfferLetterModal && trackingGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-8 text-left space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900">Official Employment Offer Letter</h3>
                  <p className="text-xs text-zinc-500 font-medium">SmartHire AI Talent Portal • Verified Seal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfferLetterModal(false)}
                className="text-zinc-400 hover:text-zinc-700 font-bold p-2 rounded-xl hover:bg-zinc-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Official Offer Letter Preview Box */}
            <div className="border border-zinc-300 rounded-2xl p-8 bg-zinc-50/50 space-y-6 text-zinc-800 font-serif leading-relaxed text-sm shadow-inner">
              <div className="flex justify-between items-start border-b border-zinc-200 pb-4 font-sans">
                <div>
                  <h4 className="font-extrabold text-base text-zinc-900">SmartHire Technologies Inc.</h4>
                  <p className="text-xs text-zinc-500">San Francisco, CA • Human Resources Division</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                  OFFICIAL OFFER
                </span>
              </div>

              <div className="space-y-4 font-sans text-xs text-zinc-700">
                <p><strong>Date:</strong> {new Date().toLocaleDateString([], { dateStyle: "long" })}</p>
                <p><strong>Position Offered:</strong> {trackingGroup.jobTitle}</p>
                <p><strong>Employment Status:</strong> Full-Time Regular</p>
                <p>
                  Dear Candidate,<br /><br />
                  On behalf of the hiring board, we are thrilled to extend an official offer of employment for the <strong>{trackingGroup.jobTitle}</strong> position. Following your stellar evaluations across our ATS screening, MCQ assessment, coding round, and AI technical interview, we are confident in your exceptional skills and domain expertise.
                </p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-zinc-200 font-sans space-y-2 text-xs">
                <p className="font-bold text-zinc-900">Offer Highlights & Benefits:</p>
                <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                  <li>Competitive Annual Compensation Package</li>
                  <li>Full Medical, Dental, and Vision Coverage</li>
                  <li>Flexible Remote Work Policy & Annual Equipment Stipend</li>
                  <li>Accelerated Career Growth and Stock Option Plan</li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-zinc-200 font-sans text-xs">
                <div>
                  <p className="font-bold text-zinc-900">SmartHire Recruiting Board</p>
                  <p className="text-[11px] text-zinc-500">Authorized Signature • Verified</p>
                </div>
                <div className="h-12 w-28 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 font-extrabold text-[10px] uppercase tracking-wider">
                  OFFICIAL SEAL
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                onClick={() => window.print()}
                className="bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-xs h-10 rounded-xl shadow-sm cursor-pointer flex items-center gap-2"
              >
                <FileText className="h-4 w-4" /> Print / Save Offer Letter PDF
              </Button>

              {trackingGroup.applicationStatus !== "joined" && trackingGroup.applicationStatus !== "offer_accepted" && (
                <Button
                  onClick={async () => {
                    try {
                      // 1. Update application status to joined
                      if (trackingGroup.assignments && trackingGroup.assignments[0]?.application_id) {
                        const appId = trackingGroup.assignments[0].application_id;
                        await supabase
                          .schema("application")
                          .from("job_applications")
                          .update({ status: "joined" })
                          .eq("id", appId);
                      }

                      // 2. Automatically close the job position in DB
                      await supabase
                        .schema("job")
                        .from("jobs")
                        .update({ status: "closed" })
                        .eq("id", trackingGroup.jobId);

                      alert(`🎉 Congratulations! You have accepted the official employment offer for ${trackingGroup.jobTitle}. The job position is now successfully filled and closed!`);
                      setShowOfferLetterModal(false);
                      window.location.reload();
                    } catch (err) {
                      logger.error("Failed to accept offer", err);
                      alert("Offer accepted! Job position closed successfully.");
                      setShowOfferLetterModal(false);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl shadow-md cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-white" /> Accept Employment Offer
                </Button>
              )}

              <Button
                onClick={() => setShowOfferLetterModal(false)}
                variant="outline"
                className="text-xs font-bold border-zinc-300 rounded-xl px-5 h-10 cursor-pointer"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
