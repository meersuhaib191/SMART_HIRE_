"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { ArrowLeft, Video, ChevronRight, BarChart3, Calendar, Clock, UserCheck, ExternalLink, Plus, Award, RefreshCw, Gift, XCircle, CheckCircle2 } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";
import { ScheduleFinalInterviewModal } from "@/components/interview/ScheduleFinalInterviewModal";
import { ScorecardModal } from "@/components/interview/ScorecardModal";
import { OfferModal } from "@/components/interview/OfferModal";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface FinalInterviewCandidateItem {
  id: string; // application_id
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status: string;
  interview_scheduled_at: string | null;
  interview_id?: string | null;
  meeting_token?: string | null;
  meeting_link?: string | null;
  interview_avg_score: number | null;
  interview_recommendation?: string | null;
  duration_minutes?: number | null;
  created_at: string;
}

export default function FinalInterviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = React.useState<string>("Job Position");
  const [candidates, setCandidates] = React.useState<FinalInterviewCandidateItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Modals state
  const [scheduleModalApp, setScheduleModalApp] = React.useState<FinalInterviewCandidateItem | null>(null);
  const [scorecardModalApp, setScorecardModalApp] = React.useState<FinalInterviewCandidateItem | null>(null);
  const [offerModalApp, setOfferModalApp] = React.useState<FinalInterviewCandidateItem | null>(null);

  const fetchFinalInterviewData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Job Title
      const { data: job } = await supabase
        .schema("job")
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .maybeSingle();

      if (job?.title) setJobTitle(job.title);

      // 2. Fetch Applications in zoom_interview or subsequent stages
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, status, interview_scheduled_at, interview_avg_score, interview_recommendation, created_at")
        .eq("job_id", jobId)
        .is("deleted_at", null);

      const appList = apps || [];

      if (appList.length > 0) {
        const candidateIds = appList.map((a) => a.candidate_id);
        const { data: cands } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id, first_name, last_name, email, avatar_url")
          .in("id", candidateIds);

        const candMap = new Map<string, any>();
        (cands || []).forEach((c) => candMap.set(c.id, c));

        // Fetch interviews records
        const appIds = appList.map((a) => a.id);
        const { data: intRecords } = await supabase
          .schema("interview")
          .from("interviews")
          .select("id, application_id, meeting_token, meeting_link, duration_minutes, start_time")
          .in("application_id", appIds);

        const intMap = new Map<string, any>();
        (intRecords || []).forEach((i) => intMap.set(i.application_id, i));

        const mapped: FinalInterviewCandidateItem[] = appList.map((app) => {
          const c = candMap.get(app.candidate_id);
          const i = intMap.get(app.id);
          const meetingToken = i?.meeting_token || `smh_meet_${app.id.slice(0, 8)}`;
          const nativeLink = `/interview/lobby/${meetingToken}`;

          return {
            id: app.id,
            candidate_id: app.candidate_id,
            first_name: c?.first_name || "Applicant",
            last_name: c?.last_name || "",
            email: c?.email || "No email provided",
            avatar_url: c?.avatar_url,
            status: app.status,
            interview_scheduled_at: app.interview_scheduled_at || i?.start_time || null,
            interview_id: i?.id || null,
            meeting_token: meetingToken,
            meeting_link: nativeLink,
            interview_avg_score: app.interview_avg_score,
            interview_recommendation: app.interview_recommendation,
            duration_minutes: i?.duration_minutes || 60,
            created_at: app.created_at,
          };
        });

        // Filter candidates for Recruiter Final Interview round
        const finalCandidates = mapped.filter((m) =>
          ["zoom_interview", "final_interview", "hiring_decision", "offer", "offer_sent", "offered", "hired", "joined"].includes(m.status)
        );
        setCandidates(finalCandidates);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      logger.error("Failed to load Recruiter Final Interview details page", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchFinalInterviewData();
  }, [fetchFinalInterviewData]);

  // Overview Metrics
  const totalCandidates = candidates.length;
  const scheduledCount = candidates.filter((c) => c.interview_scheduled_at != null && c.interview_avg_score == null).length;
  const completedList = candidates.filter((c) => c.interview_avg_score != null || ["hiring_decision", "offer", "hired"].includes(c.status));
  const completedCount = completedList.length;
  const pendingCount = Math.max(0, totalCandidates - scheduledCount - completedCount);

  const scores = completedList.map((c) => c.interview_avg_score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 sm:px-6 text-left sh-animate-in">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
            <Link href="/recruiter/pipeline" className="hover:text-blue-600">Jobs</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-700 font-bold">{jobTitle}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-indigo-600 font-bold">Recruiter Final Interview</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Video className="h-6 w-6 text-indigo-600" />
            Recruiter Final Interview Detailed View
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/recruiter/pipeline?jobId=${jobId}`)}
            className="text-xs font-bold gap-1.5 border-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
          </Button>
          <Button
            onClick={() => router.push(`/recruiter/pipeline?jobId=${jobId}`)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Open Full Kanban Board
          </Button>
        </div>
      </div>

      {/* Overview Metrics Toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Candidates</span>
          <span className="text-2xl font-black text-zinc-900">{totalCandidates}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending Scheduling</span>
          <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Scheduled</span>
          <span className="text-2xl font-black text-blue-600">{scheduledCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Completed</span>
          <span className="text-2xl font-black text-emerald-600">{completedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Average Score</span>
          <span className="text-2xl font-black text-indigo-600">{avgScore != null ? `${avgScore}%` : "—"}</span>
        </div>
      </div>

      {/* Candidates Roster Table */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
            Recruiter Final Interview Roster
          </h3>
          <span className="text-xs font-medium text-zinc-500">{candidates.length} Candidates</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-medium">Loading final interview roster...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">
            No candidates scheduled for recruiter final interview yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">Interview Date & Time</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Score & Rec.</th>
                  <th className="p-3.5">SmartHire Meeting Room</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {candidates.map((c) => {
                  const isDone = c.interview_avg_score != null || ["hiring_decision", "offer", "hired"].includes(c.status);
                  const isScheduled = Boolean(c.interview_scheduled_at);

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{c.first_name} {c.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">
                        {c.interview_scheduled_at ? (
                          new Date(c.interview_scheduled_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                        ) : (
                          <span className="text-amber-600 font-bold">Not Scheduled</span>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">
                        {c.duration_minutes} mins
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isDone
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isScheduled
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {isDone ? "Completed" : isScheduled ? "Scheduled" : "Pending"}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold">
                        {c.interview_avg_score != null ? (
                          <div>
                            <span className="text-emerald-600 text-sm font-black">{c.interview_avg_score}%</span>
                            {c.interview_recommendation && (
                              <span className="block text-[10px] font-extrabold text-zinc-500 uppercase">
                                {c.interview_recommendation.replace("_", " ")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 font-medium italic">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {c.meeting_link ? (
                          <Link
                            href={c.meeting_link}
                            className="inline-flex items-center gap-1.5 text-indigo-600 font-extrabold hover:underline text-[11px] bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100"
                          >
                            <Video className="h-3.5 w-3.5" /> Launch Room
                          </Link>
                        ) : (
                          <span className="text-zinc-400 italic">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right flex items-center justify-end gap-2">
                        {!isScheduled && !isDone && (
                          <Button
                            size="sm"
                            onClick={() => setScheduleModalApp(c)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold h-7.5 px-3 shadow-xs cursor-pointer"
                          >
                            Schedule
                          </Button>
                        )}

                        {isScheduled && !isDone && (
                          <Link href={c.meeting_link || "#"}>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold h-7.5 px-3 shadow-xs cursor-pointer"
                            >
                              Join Interview
                            </Button>
                          </Link>
                        )}

                        {isDone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setScorecardModalApp(c)}
                            className="text-[11px] font-bold h-7.5 px-2.5 border-zinc-300 cursor-pointer"
                          >
                            <Award className="h-3.5 w-3.5 text-indigo-600 mr-1" /> Evaluation
                          </Button>
                        )}

                        {/* Offer / Reject Decision Buttons */}
                        {["zoom_interview", "final_interview", "hiring_decision", "completed"].includes(c.status) || isDone ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setOfferModalApp(c)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold h-7.5 px-3 shadow-xs gap-1 cursor-pointer"
                            >
                              <Gift className="h-3.5 w-3.5" /> Offer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to reject ${c.first_name} ${c.last_name}?`)) {
                                  await supabase.schema("application").from("applications").update({ status: "rejected" }).eq("id", c.id);
                                  fetchFinalInterviewData();
                                }
                              }}
                              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 text-[11px] font-bold h-7.5 px-2.5 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        ) : c.status === "offer_sent" || c.status === "offered" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                            <Gift className="h-3.5 w-3.5 text-emerald-600" /> Offer Sent
                          </span>
                        ) : c.status === "hired" || c.status === "joined" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500 text-white">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Hired
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Final Interview Modal */}
      {scheduleModalApp && (
        <ScheduleFinalInterviewModal
          isOpen={Boolean(scheduleModalApp)}
          onClose={() => setScheduleModalApp(null)}
          onSuccess={() => {
            setScheduleModalApp(null);
            fetchFinalInterviewData();
          }}
          applicationId={scheduleModalApp.id}
          candidateName={`${scheduleModalApp.first_name} ${scheduleModalApp.last_name}`}
          candidateEmail={scheduleModalApp.email}
          jobTitle={jobTitle}
        />
      )}

      {/* Scorecard Evaluation View Modal */}
      {scorecardModalApp && (
        <ScorecardModal
          isOpen={Boolean(scorecardModalApp)}
          onClose={() => setScorecardModalApp(null)}
          onSuccess={() => {
            setScorecardModalApp(null);
            fetchFinalInterviewData();
          }}
          interviewId={scorecardModalApp.interview_id || scorecardModalApp.id}
          candidateName={`${scorecardModalApp.first_name} ${scorecardModalApp.last_name}`}
          jobTitle={jobTitle}
        />
      )}

      {/* Offer Letter Generation Modal */}
      {offerModalApp && (
        <OfferModal
          isOpen={Boolean(offerModalApp)}
          onClose={() => setOfferModalApp(null)}
          onSuccess={() => {
            setOfferModalApp(null);
            fetchFinalInterviewData();
          }}
          applicationId={offerModalApp.id}
          candidateName={`${offerModalApp.first_name} ${offerModalApp.last_name}`}
          candidateEmail={offerModalApp.email}
          jobTitle={jobTitle}
        />
      )}
    </div>
  );
}
