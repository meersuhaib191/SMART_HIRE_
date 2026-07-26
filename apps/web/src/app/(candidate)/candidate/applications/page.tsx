"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { UnreadDot } from "@/components/shared/UnreadDot";
import { Loader2, Calendar, ArrowRight, Clock, Sparkles, Briefcase, Trophy, CheckCircle2, Search, Filter, Play, LayoutDashboard } from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";
import { isTechDomain } from "@/utils/domain-utils";
import { resolveCandidateProfileIds } from "@/utils/candidate-helper";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface AssignmentDetails {
  id: string;
  scheduled_start_at?: string | null;
  expires_at?: string | null;
  status: string;
  isReady: boolean;
}

interface ActiveApplication {
  id: string;
  created_at: string;
  status: string;
  rejection_stage?: string | null;
  job_title: string;
  job_category?: string | null;
  job_id: string;
  score?: number | null;
  assignment?: AssignmentDetails | null;
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

function StageProgressBar({ currentStatus, isTech = true }: { currentStatus: string; isTech?: boolean }) {
  const stages = isTech ? STAGE_ORDER : STAGE_ORDER.filter((s) => s !== "coding");

  const getActiveStageIndex = (status: string) => {
    switch (status) {
      case "applied": return 0;
      case "screening": return 1;
      case "mcq": return 2;
      case "coding": return isTech ? 3 : 2;
      case "interview": return isTech ? 4 : 3;
      case "offered":
      case "accepted":
      case "hired": return isTech ? 5 : 4;
      default: return 0;
    }
  };

  const idx = getActiveStageIndex(currentStatus);

  return (
    <div className="flex items-center gap-0 w-full mt-2">
      {stages.map((stage, i) => {
        const isCompleted = i < idx;
        const isCurrent = i === idx;
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
                {STAGE_LABELS[stage]}
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

export default function CandidateApplicationsPage() {
  const { hasUnreadForContext, markContextAsRead } = useNotifications();
  const [applications, setApplications] = React.useState<ActiveApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  // Offer Letter View & Accept Modal State
  const [selectedOfferApp, setSelectedOfferApp] = React.useState<ActiveApplication | null>(null);
  const [offerModalOpen, setOfferModalOpen] = React.useState(false);
  const [acceptingOffer, setAcceptingOffer] = React.useState(false);

  React.useEffect(() => {
    const fetchApplications = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const candIds = await resolveCandidateProfileIds(supabase, authUser);

        if (candIds.length > 0) {
          const { data: apps, error } = await supabase
            .schema("application")
            .from("applications")
            .select("id, created_at, status, rejection_stage, job_id, score")
            .in("candidate_id", candIds)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (apps && apps.length > 0) {
            const jobIds = apps.map((a) => a.job_id);
            const { data: jobs } = await supabase
              .schema("job")
              .from("jobs")
              .select("id, title, category, mcq_scheduled_start_at, coding_scheduled_start_at")
              .in("id", jobIds);

            const { data: assignments } = await supabase
              .schema("assessment")
              .from("assignments")
              .select("id, application_id, assessment_id, status, scheduled_start_at, expires_at")
              .in("candidate_id", candIds);

            const now = new Date();

            const mapped: ActiveApplication[] = apps.map((app) => {
              const job = (jobs || []).find((j) => j.id === app.job_id);
              const matchingAssignment = (assignments || []).find((as) => as.application_id === app.id);

              const schedStart = matchingAssignment?.scheduled_start_at || (
                app.status === "mcq" ? job?.mcq_scheduled_start_at :
                app.status === "coding" ? job?.coding_scheduled_start_at : null
              );

              let isReady = false;
              if (schedStart) {
                const startTime = new Date(schedStart);
                const notExpired = !matchingAssignment?.expires_at || new Date(matchingAssignment.expires_at) > now;
                isReady = startTime <= now && notExpired && matchingAssignment?.status !== "completed";
              } else if (matchingAssignment && matchingAssignment.status !== "completed") {
                isReady = true;
              }

              const assignmentDetails: AssignmentDetails | null = (matchingAssignment || schedStart) ? {
                id: matchingAssignment?.id || app.id,
                scheduled_start_at: schedStart,
                expires_at: matchingAssignment?.expires_at,
                status: matchingAssignment?.status || "assigned",
                isReady,
              } : null;

              return {
                id: app.id,
                created_at: app.created_at,
                status: app.status,
                job_title: job ? job.title : "Hiring position",
                job_category: job?.category || null,
                job_id: app.job_id,
                score: app.score,
                assignment: assignmentDetails,
              };
            });
            setApplications(mapped);
          } else {
            setApplications([]);
          }
        }
      } catch (err) {
        logger.error("Failed to load candidate applications list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const filteredApplications = React.useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch = app.job_title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || app.status.toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, searchQuery, statusFilter]);

  const activePipelinesCount = applications.filter((a) => !["rejected", "withdrawn"].includes(a.status)).length;
  const inAssessmentCount = applications.filter((a) => ["mcq", "coding", "interview"].includes(a.status)).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500 font-medium">Loading active applications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 text-left animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
          Candidate Portal
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          My Applications
        </h1>
        <p className="text-sm text-zinc-500 font-medium">
          Track stage progression milestones, scheduled assessment exam entries, and live interview rooms.
        </p>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Applications", value: applications.length, icon: Briefcase, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "Active Pipelines", value: activePipelinesCount, icon: Clock, color: "text-purple-600 bg-purple-50 border-purple-100" },
          { label: "In Assessment / Interview", value: inAssessmentCount, icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        ].map((stat) => (
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2 text-xs font-medium text-zinc-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0 mr-1" />
          {["all", "applied", "screening", "mcq", "coding", "interview", "offered"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all shrink-0 ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              {st === "mcq" ? "MCQ" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-6">
        {filteredApplications.map((app) => {
          const isUnread = hasUnreadForContext({ applicationId: app.id });
          return (
            <div
              key={app.id}
              onClick={() => {
                if (isUnread) markContextAsRead({ applicationId: app.id });
              }}
              className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{app.job_title}</span>
                      {isUnread && <UnreadDot size="sm" />}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-white/80 font-medium mt-0.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Applied {new Date(app.created_at).toLocaleDateString([], { dateStyle: "medium" })}</span>
                    </div>
                  </div>
                </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize backdrop-blur-sm border ${
                  app.status === "rejected"
                    ? "bg-red-500/40 text-red-100 border-red-400/50"
                    : "bg-white/20 text-white border-white/20"
                }`}>
                  {app.status === "rejected"
                    ? `Rejected at ${STAGE_LABELS[app.rejection_stage || "screening"] || app.rejection_stage || "Screening"}`
                    : STAGE_LABELS[app.status] || app.status}
                </span>
                <Link href={`/candidate/jobs/${app.job_id}`}>
                  <Button className="bg-white hover:bg-zinc-100 text-blue-700 font-bold text-xs h-8 px-3 rounded-lg shadow-sm flex items-center gap-1">
                    Job Details <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Application Body */}
            <div className="p-6 space-y-5">
              {/* Action Banner for Active Exam / Interview Rounds */}
              {app.status === "mcq" && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        {app.assignment?.isReady ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-indigo-950">MCQ Test Assessment Round</span>
                    </div>
                    <p className="text-xs text-zinc-600 font-medium">
                      {!app.assignment?.scheduled_start_at ? (
                        "MCQ exam round scheduled soon by recruiter."
                      ) : app.assignment.isReady ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                          The MCQ Test is LIVE! You may enter and begin now.
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-500" />
                          Scheduled for: <strong>{new Date(app.assignment.scheduled_start_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}</strong>
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    {app.assignment?.id && app.assignment.isReady ? (
                      <Link href={`/candidate/assessments/${app.assignment.id}/exam`}>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm flex items-center gap-1.5 animate-pulse">
                          Start MCQ Test <Play className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/candidate/assessments">
                        <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs h-9 px-4 rounded-xl">
                          View Assessments
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {app.status === "coding" && isTechDomain(app.job_category, app.job_title) && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        {app.assignment?.isReady ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-emerald-950">Coding Interview Round (Built-in IDE)</span>
                    </div>
                    <p className="text-xs text-zinc-600 font-medium">
                      {!app.assignment?.scheduled_start_at ? (
                        "Coding exam round scheduled soon by recruiter."
                      ) : app.assignment.isReady ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                          Coding IDE environment is LIVE! You may launch the IDE now.
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-emerald-500" />
                          Scheduled for: <strong>{new Date(app.assignment.scheduled_start_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}</strong>
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    {app.assignment?.id && app.assignment.isReady ? (
                      <Link href={`/candidate/coding/${app.assignment.id}/exam`}>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm flex items-center gap-1.5 animate-pulse">
                          Launch Coding IDE <Play className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/candidate/assessments">
                        <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold text-xs h-9 px-4 rounded-xl">
                          View Assessments
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {app.status === "interview" && (
                <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-teal-950 block">Technical Interview Round</span>
                    <p className="text-xs text-zinc-600 font-medium">
                      Congratulations on advancing! Check your interview schedule and join live video lobbies.
                    </p>
                  </div>

                  <div>
                    <Link href="/candidate/interviews">
                      <Button className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm flex items-center gap-1.5">
                        View Interview Lobbies <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {["offer_sent", "offered", "offer_accepted", "joined"].includes(app.status) && (
                <div className="p-4 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600 animate-bounce" />
                      <span className="text-xs font-extrabold text-emerald-950">
                        {["offer_accepted", "joined"].includes(app.status)
                          ? "🎉 Formal Employment Offer Accepted & Signed!"
                          : "📜 Official Employment Offer Received!"}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">
                      {["offer_accepted", "joined"].includes(app.status)
                        ? "Congratulations! You have signed and accepted your formal employment offer."
                        : "Review your official appointment document, salary details, and confirm acceptance."}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedOfferApp(app);
                      setOfferModalOpen(true);
                    }}
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    📜 {["offer_accepted", "joined"].includes(app.status) ? "View Signed Offer Letter" : "Review & Accept Offer"}
                  </button>
                </div>
              )}

              {/* Stage Progress Bar Component */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Stage Progress Tracker
                </span>
                <StageProgressBar currentStatus={app.status} isTech={isTechDomain(app.job_category, app.job_title)} />
              </div>
            </div>
          </div>
        );
      })}

        {filteredApplications.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-500 italic text-sm">
            No applications matching your search or filter.
          </div>
        )}
      </div>

      {/* Candidate Offer Letter Viewer Modal */}
      {offerModalOpen && selectedOfferApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200 flex flex-col max-h-[90vh]">
            <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-extrabold tracking-tight">Official Employment Offer Letter</h3>
              </div>
              <button
                onClick={() => setOfferModalOpen(false)}
                className="text-zinc-400 hover:text-white h-8 w-8 rounded-full flex items-center justify-center text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-zinc-200/80 flex flex-col items-center">
              {(() => {
                const storedOffer = typeof window !== "undefined"
                  ? JSON.parse(localStorage.getItem(`smarthire_custom_offer_${selectedOfferApp.id}`) || "{}")
                  : {};

                const companyName = storedOffer.companyName || "Hiring Employer";
                const companyDivision = storedOffer.companyDivision || "Corporate HR & Talent Acquisition Division";
                const salary = storedOffer.salary || "$120,000 / annum";
                const joiningDate = storedOffer.joiningDate || "2026-08-06";
                const location = storedOffer.location || "San Francisco, CA / Remote";
                const isAccepted = ["offer_accepted", "joined"].includes(selectedOfferApp.status) || Boolean(storedOffer.acceptedAt);

                return (
                  <div className="w-full bg-white text-zinc-900 rounded-2xl shadow-xl p-8 space-y-5 text-left border border-zinc-300 font-sans text-xs">
                    {/* Document Header */}
                    <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-end">
                      <div>
                        <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">Official Appointment Document</span>
                        <h2 className="text-base font-black text-zinc-900 tracking-tight mt-0.5 uppercase">{companyName}</h2>
                        <p className="text-[10px] text-zinc-500 font-medium">{companyDivision}</p>
                      </div>
                      <div className="text-right text-[9px] font-mono text-zinc-500 font-bold">
                        <div>REF: OFFER-2026-{selectedOfferApp.id.slice(0, 6)}</div>
                        <div>DATE: {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</div>
                      </div>
                    </div>

                    {/* Recipient */}
                    <div className="space-y-0.5">
                      <p className="font-bold text-zinc-900">To:</p>
                      <p className="font-extrabold text-sm text-zinc-900">Applicant Candidate</p>
                      <p className="text-zinc-600 text-[11px]">Position: {selectedOfferApp.job_title}</p>
                    </div>

                    {/* Subject */}
                    <div className="font-bold text-zinc-900 border-l-4 border-emerald-600 pl-3 py-1 bg-emerald-50 text-[11px]">
                      SUBJECT: Employment Offer for Position of {selectedOfferApp.job_title}
                    </div>

                    {/* Body */}
                    <div className="space-y-3 text-zinc-700 text-[11px] leading-normal">
                      <p>Dear Candidate,</p>
                      <p>
                        We are pleased to extend this formal offer of employment to join <span className="font-bold text-zinc-900">{companyName}</span> as a <span className="font-bold text-zinc-900">{selectedOfferApp.job_title}</span>. We were thoroughly impressed by your background, technical scorecards, and performance throughout our evaluation pipeline conducted via the <span className="font-semibold text-zinc-900">SmartHire AI Hiring Platform</span>.
                      </p>
                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1.5 font-mono text-[10px] text-zinc-900">
                        <div className="flex justify-between"><span>Annual Compensation:</span><span className="font-bold text-emerald-700">{salary}</span></div>
                        <div className="flex justify-between"><span>Joining Date:</span><span className="font-bold">{joiningDate}</span></div>
                        <div className="flex justify-between"><span>Work Location:</span><span className="font-bold">{location}</span></div>
                      </div>
                      <p>
                        This offer is subject to standard employment verification and compliance. Please review this letter and confirm your acceptance.
                      </p>
                    </div>

                    {/* Signatures */}
                    <div className="pt-5 border-t border-zinc-200 grid grid-cols-2 gap-6 text-[10px]">
                      <div>
                        <p className="font-bold text-zinc-900">For {companyName}</p>
                        <div className="h-10 my-1 font-serif italic text-emerald-800 text-sm flex items-end">Authorized HR Executive</div>
                        <p className="text-zinc-500 font-semibold border-t border-zinc-300 pt-1">Hiring Manager Signature</p>
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">Candidate Acceptance</p>
                        <div className="h-10 my-1 font-serif italic text-emerald-700 text-xs flex items-end">
                          {isAccepted ? "✅ Digitally Signed & Accepted" : "Pending Acceptance Signature"}
                        </div>
                        <p className="text-zinc-500 font-semibold border-t border-zinc-300 pt-1">Applicant Signature</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-dashed border-zinc-200 text-center text-[9px] text-zinc-400 font-medium">
                      Evaluated & Dispatched via SmartHire AI Hiring Platform
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                🖨️ Print / Download PDF
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOfferModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>

                {!["offer_accepted", "joined"].includes(selectedOfferApp.status) && (
                  <button
                    type="button"
                    disabled={acceptingOffer}
                    onClick={async () => {
                      setAcceptingOffer(true);
                      try {
                        // 1. Update application status in DB to "joined"
                        await fetch(`/api/applications/${selectedOfferApp.id}/status`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "joined" }),
                        });

                        // 2. Mark job as closed in database so it gets hidden from public job listings
                        await supabase
                          .schema("job")
                          .from("jobs")
                          .update({ status: "closed", updated_at: new Date().toISOString() })
                          .eq("id", selectedOfferApp.job_id);

                        // 3. Mark offer accepted in local storage
                        const existingStr = localStorage.getItem(`smarthire_custom_offer_${selectedOfferApp.id}`);
                        const existing = existingStr ? JSON.parse(existingStr) : {};
                        existing.acceptedAt = new Date().toISOString();
                        localStorage.setItem(`smarthire_custom_offer_${selectedOfferApp.id}`, JSON.stringify(existing));

                        // 4. Update state locally
                        setApplications((prev) =>
                          prev.map((a) => (a.id === selectedOfferApp.id ? { ...a, status: "joined" } : a))
                        );

                        alert("🎉 Congratulations! You have formally accepted and signed your employment offer! The position is now closed and confirmed.");
                        setOfferModalOpen(false);
                      } catch (err) {
                        logger.error("Failed to accept offer", err);
                        alert("Failed to confirm offer acceptance. Please try again.");
                      } finally {
                        setAcceptingOffer(false);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {acceptingOffer ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing & Confirming...</>
                    ) : (
                      <>✍️ Accept & Sign Employment Offer</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

