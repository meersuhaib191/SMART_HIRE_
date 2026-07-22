"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import {
  Loader2, Play, CheckCircle2, Calendar, Code, FileText,
  Clock, Trophy, AlertCircle, ChevronRight, Briefcase, Lock, Star
} from "lucide-react";
import { logger } from "@smarthire/logger";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

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
  appliedAt: string;
  applicationStatus: string;
  assignments: AssignmentItem[];
}

const STAGE_ORDER = ["applied", "screening", "mcq", "coding", "interview", "offered"];
const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  mcq: "MCQ Test",
  coding: "Coding Round",
  interview: "Interview",
  offered: "Offer",
};

function StageProgressBar({ currentStatus }: { currentStatus: string }) {
  const idx = STAGE_ORDER.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-0 w-full mt-3">
      {STAGE_ORDER.map((stage, i) => {
        const isCompleted = i < idx;
        const isCurrent = i === idx;
        const isUpcoming = i > idx;
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
              <span className={`text-[9px] font-semibold truncate w-full text-center ${
                isCurrent ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-zinc-400"
              }`}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div className={`h-0.5 flex-1 mb-4 rounded-full transition-all ${
                i < idx ? "bg-emerald-400" : "bg-zinc-200"
              }`} />
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
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
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
  const isFuture = item.scheduled_start_at ? new Date(item.scheduled_start_at) > now : false;
  const isExpired = item.expires_at ? new Date(item.expires_at) < now && !isCompleted : false;

  const typeColor = item.type === "coding"
    ? { bg: "from-emerald-500 to-teal-600", light: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: Code }
    : { bg: "from-indigo-500 to-violet-600", light: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: FileText };

  const Icon = typeColor.icon;

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
      isCompleted ? "border-emerald-200" : isExpired ? "border-red-200 opacity-75" : isFuture ? "border-amber-200" : "border-zinc-200 hover:border-blue-300"
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

        {/* Completion Date */}
        {isCompleted && item.attempt?.completed_at && (
          <p className="text-[10px] text-zinc-400 italic">
            Completed {new Date(item.attempt.completed_at).toLocaleDateString([], { dateStyle: "medium" })}
          </p>
        )}

        {/* CTA */}
        <div className="pt-2 border-t border-zinc-100">
          {isCompleted ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold">Assessment Complete</span>
            </div>
          ) : isExpired ? (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-bold">This assessment has expired</span>
            </div>
          ) : isFuture ? (
            <Button disabled className="w-full h-9 text-xs font-bold rounded-xl opacity-60 cursor-not-allowed">
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Locked Until Scheduled Time
            </Button>
          ) : (
            <Link href={item.type === "coding" ? `/candidate/coding/${item.id}/exam` : `/candidate/assessments/${item.id}/exam`} className="w-full">
              <Button className={`w-full h-9 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer ${
                item.type === "coding" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}>
                {item.type === "coding" ? "Launch Coding IDE" : "Start MCQ Test"} <Play className="h-3.5 w-3.5" />
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

        // Get candidate profile
        let { data: profile } = await supabase
          .schema("candidate").from("candidates")
          .select("id").eq("user_id", authUser.id).maybeSingle();

        if (!profile) {
          const { data: newP } = await supabase
            .schema("candidate").from("candidates")
            .insert({
              user_id: authUser.id,
              email: authUser.email || "",
              first_name: authUser.user_metadata?.first_name || "Candidate",
              last_name: authUser.user_metadata?.last_name || "",
              summary: "", tags: []
            }).select("id").single();
          profile = newP;
        }
        if (!profile) return;

        // Fetch applications with job info
        const { data: applications } = await supabase
          .schema("application").from("applications")
          .select("id, job_id, status, created_at")
          .eq("candidate_id", profile.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (!applications || applications.length === 0) {
          setJobGroups([]);
          return;
        }

        // Fetch job titles
        const jobIds = [...new Set(applications.map(a => a.job_id))];
        const { data: jobs } = await supabase
          .schema("job").from("jobs")
          .select("id, title")
          .in("id", jobIds);

        // Fetch assignments
        const { data: rawAssignments } = await supabase
          .schema("assessment").from("assignments")
          .select("id, assessment_id, application_id, status, expires_at, created_at, scheduled_start_at")
          .eq("candidate_id", profile.id);

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
          .eq("candidate_id", profile.id);

        // Group assignments by application/job
        const groups: JobGroup[] = applications.map(app => {
          const job = (jobs || []).find(j => j.id === app.job_id);
          const appAssignments = (rawAssignments || []).filter(a => a.application_id === app.id || !a.application_id);

          const mapped: AssignmentItem[] = appAssignments.map(assignment => {
            const tmpl = (templates || []).find(t => t.id === assignment.assessment_id);
            const attempt = (rawAttempts || []).find(
              a => a.assignment_id === assignment.id || a.assessment_id === assignment.assessment_id
            );
            const isCoding = codingIds.has(assignment.assessment_id) ||
              Boolean(tmpl?.title?.toLowerCase().includes("coding"));

            return {
              id: assignment.id,
              assessment_id: assignment.assessment_id,
              application_id: assignment.application_id,
              title: tmpl?.title ?? (isCoding ? "Coding Interview Assessment" : "Technical MCQ Assessment"),
              type: isCoding ? "coding" : "mcq",
              duration_minutes: tmpl?.duration_minutes ?? 60,
              scheduled_start_at: assignment.scheduled_start_at,
              expires_at: assignment.expires_at,
              status: assignment.status,
              attempt: attempt ? {
                id: attempt.id,
                score: attempt.score,
                passed: attempt.passed,
                started_at: attempt.started_at,
                completed_at: attempt.completed_at,
              } : null,
            };
          });

          return {
            jobId: app.job_id,
            jobTitle: job?.title ?? "Unknown Position",
            appliedAt: app.created_at,
            applicationStatus: app.status,
            assignments: mapped,
          };
        });

        setJobGroups(groups);
        // Auto-expand all jobs that have active assessments
        const toExpand = new Set<string>(
          groups.filter(g => g.assignments.some(a => !a.attempt?.completed_at)).map(g => g.jobId + g.appliedAt)
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
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Candidate Portal</span>
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
                <button
                  onClick={() => toggleJob(key)}
                  className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-zinc-50 transition-colors"
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
                          Status: <span className={`font-bold ${
                            group.applicationStatus === "offered" ? "text-emerald-600" :
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
                      <StageProgressBar currentStatus={group.applicationStatus} />
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-zinc-400 shrink-0 mt-1 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                </button>

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
    </div>
  );
}
