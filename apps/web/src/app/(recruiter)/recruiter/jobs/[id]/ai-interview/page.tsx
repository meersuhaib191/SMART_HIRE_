"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Clock,
  Award,
  Search,
  ChevronRight,
  FileText,
  Loader2,
  Eye,
  Layers,
  RefreshCw,
  X,
  UserCheck,
  Calendar,
  Download,
  AlertCircle,
  TrendingUp,
  History,
  Send
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

export const dynamic = "force-dynamic";

interface CandidateInterviewItem {
  id: string; // application_id
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string; // pending, scheduled, in_progress, evaluation_processing, completed, advanced
  scorePct: number | null;
  attemptId?: string;
  attemptCount: number;
  attemptsHistory: { attemptNumber: number; score: number; completedAt: string }[];
  submittedAt?: string;
  timeSpentSeconds?: number;
  evaluation?: any;
  transcript?: any[];
  technicalScore?: number;
  problemSolvingScore?: number;
  evidenceStatus?: string;
  applicationStatus: string;
}

export default function RecruiterAIInterviewDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [jobTitle, setJobTitle] = React.useState("Job Position");
  const [candidates, setCandidates] = React.useState<CandidateInterviewItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedResult, setSelectedResult] = React.useState<CandidateInterviewItem | null>(null);

  // Top N Advancement Modal State
  const [advanceCount, setAdvanceCount] = React.useState(1);
  const [showAdvanceConfirmModal, setShowAdvanceConfirmModal] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  // Re-interview Modal State
  const [reinterviewCandidate, setReinterviewCandidate] = React.useState<CandidateInterviewItem | null>(null);
  const [reinterviewTime, setReinterviewTime] = React.useState("");
  const [reinterviewDuration, setReinterviewDuration] = React.useState(60);
  const [reinterviewTopics, setReinterviewTopics] = React.useState("");
  const [reinterviewing, setReinterviewing] = React.useState(false);

  const supabase = createClient();

  const handleReturn = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/recruiter/jobs/${jobId}/applications`);
    }
  };

  const fetchInterviewData = React.useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch Job Info
      const { data: job } = await supabase
        .schema("job")
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .maybeSingle();

      if (job?.title) setJobTitle(job.title);

      // 2. Fetch Applications for this job
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, status, ai_interview_score, interview_avg_score, updated_at, created_at")
        .eq("job_id", jobId)
        .is("deleted_at", null);

      if (!apps || apps.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      // 3. Fetch Candidate Profiles
      const candidateIds = apps.map((a) => a.candidate_id);
      const { data: profiles } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, first_name, last_name, email")
        .in("id", candidateIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      // 4. Fetch Assignments & Attempts History
      const appIds = apps.map((a) => a.id);
      const { data: assignments } = await supabase
        .schema("assessment")
        .from("assignments")
        .select("id, application_id, status")
        .in("application_id", appIds);

      const assignList = assignments || [];
      const assignIds = assignList.map((a) => a.id);
      const assignMap = new Map(assignList.map((a) => [a.application_id, a]));

      let attemptsGroupMap = new Map<string, any[]>();
      if (assignIds.length > 0) {
        const { data: attempts } = await supabase
          .schema("assessment")
          .from("attempts")
          .select("*")
          .in("assignment_id", assignIds)
          .order("started_at", { ascending: true });

        (attempts || []).forEach((att) => {
          const list = attemptsGroupMap.get(att.assignment_id) || [];
          list.push(att);
          attemptsGroupMap.set(att.assignment_id, list);
        });
      }

      // 5. Map Candidates with Authoritative Scores & Multi-Attempt History
      const mapped: CandidateInterviewItem[] = apps.map((app) => {
        const profile = profileMap.get(app.candidate_id) || { first_name: "Applicant", last_name: "", email: "" };
        const assign = assignMap.get(app.id);
        const attemptList = assign ? (attemptsGroupMap.get(assign.id) || []) : [];
        const latestAtt = attemptList.length > 0 ? attemptList[attemptList.length - 1] : null;

        // Authoritative score is stored as 0-100 percentage integer
        let scorePct: number | null = null;
        if (latestAtt && typeof latestAtt.score === "number" && latestAtt.score > 0) {
          scorePct = Math.min(100, Math.max(0, Math.round(latestAtt.score)));
        } else if (typeof app.ai_interview_score === "number" && app.ai_interview_score > 0) {
          scorePct = Math.min(100, Math.max(0, Math.round(app.ai_interview_score)));
        } else if (typeof app.interview_avg_score === "number" && app.interview_avg_score > 0) {
          scorePct = Math.min(100, Math.max(0, Math.round(app.interview_avg_score)));
        }

        const evaluation = latestAtt?.answers?.evaluation || null;
        const evidenceStatus = evaluation?.evaluationStatus;

        // History list mapping
        const attemptsHistory = attemptList.map((att, idx) => ({
          attemptNumber: idx + 1,
          score: Math.min(100, Math.max(0, Math.round(att.score || 0))),
          completedAt: att.completed_at || att.created_at,
        }));

        let itemStatus = "pending";
        if (app.status === "zoom_interview" || app.status === "final_interview" || app.status === "hiring_decision" || app.status === "offer_sent" || app.status === "hired") {
          itemStatus = "advanced";
        } else if (latestAtt?.status === "completed" || assign?.status === "completed") {
          itemStatus = "completed";
        } else if (latestAtt?.status === "evaluation_processing") {
          itemStatus = "evaluation_processing";
        } else if (latestAtt?.status === "in_progress" || assign?.status === "in_progress") {
          itemStatus = "in_progress";
        } else if (assign) {
          itemStatus = "scheduled";
        }

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          status: itemStatus,
          scorePct,
          attemptId: latestAtt?.id,
          attemptCount: attemptList.length || 1,
          attemptsHistory,
          submittedAt: latestAtt?.completed_at ? new Date(latestAtt.completed_at).toLocaleDateString() : undefined,
          timeSpentSeconds: latestAtt?.time_spent_seconds,
          evaluation,
          transcript: latestAtt?.answers?.transcript,
          technicalScore: evaluation?.technicalCompetence?.score || 0,
          problemSolvingScore: evaluation?.problemSolving?.score || 0,
          evidenceStatus,
          applicationStatus: app.status,
        };
      });

      setCandidates(mapped);
    } catch (err) {
      logger.error("Error fetching AI Interview details data", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, supabase]);

  React.useEffect(() => {
    fetchInterviewData();
  }, [fetchInterviewData]);

  // Derived Roster & Metrics
  const totalCount = candidates.length;
  const pendingCount = candidates.filter((c) => c.status === "pending").length;
  const scheduledCount = candidates.filter((c) => c.status === "scheduled").length;
  const inProgressCount = candidates.filter((c) => c.status === "in_progress").length;
  const processingCount = candidates.filter((c) => c.status === "evaluation_processing").length;
  const completedList = candidates.filter((c) => c.status === "completed" || c.status === "advanced");
  const advancedCount = candidates.filter((c) => c.status === "advanced").length;

  // Valid completed score list
  const validCompletedScores = completedList
    .map((c) => c.scorePct)
    .filter((s): s is number => s !== null && s > 0 && c.evidenceStatus !== "insufficient_evidence");

  const averageScore = validCompletedScores.length > 0
    ? Math.round(validCompletedScores.reduce((a, b) => a + b, 0) / validCompletedScores.length)
    : null;

  // Eligible for Top N advancement (completed + evaluated + score > 0 + not yet advanced)
  const eligibleUnadvancedCandidates = candidates
    .filter((c) => c.status === "completed" && c.scorePct !== null && c.scorePct > 0 && c.evidenceStatus !== "insufficient_evidence")
    .sort((a, b) => {
      // Deterministic Ranking: 1. scorePct DESC, 2. technicalScore DESC, 3. problemSolvingScore DESC
      if ((b.scorePct || 0) !== (a.scorePct || 0)) return (b.scorePct || 0) - (a.scorePct || 0);
      if ((b.technicalScore || 0) !== (a.technicalScore || 0)) return (b.technicalScore || 0) - (a.technicalScore || 0);
      return (b.problemSolvingScore || 0) - (a.problemSolvingScore || 0);
    });

  // Top N selected preview list for confirmation modal
  const selectedTopNPreview = eligibleUnadvancedCandidates.slice(0, Math.min(advanceCount, eligibleUnadvancedCandidates.length));

  // Handle Server-Side Top N Advancement
  const handleConfirmAdvanceTopN = async () => {
    try {
      setAdvancing(true);
      const res = await fetch(`/api/recruiter/jobs/${jobId}/advance-ai-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topN: advanceCount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Advancement failed");

      setShowAdvanceConfirmModal(false);
      await fetchInterviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Advancement Error: ${msg}`);
    } finally {
      setAdvancing(false);
    }
  };

  // Handle Re-interview Schedule
  const handleScheduleReinterview = async () => {
    if (!reinterviewCandidate) return;
    try {
      setReinterviewing(true);
      const res = await fetch(`/api/recruiter/jobs/${jobId}/schedule-reinterview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: reinterviewCandidate.id,
          scheduledAt: reinterviewTime || undefined,
          durationMinutes: reinterviewDuration || 60,
          focusTopics: reinterviewTopics || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule re-interview");

      setReinterviewCandidate(null);
      await fetchInterviewData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Re-interview Error: ${msg}`);
    } finally {
      setReinterviewing(false);
    }
  };

  // Filtered Roster
  const filteredCandidates = candidates
    .filter((c) => {
      const matchText = `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase());
      if (statusFilter === "all") return matchText;
      if (statusFilter === "completed") return matchText && (c.status === "completed" || c.status === "advanced");
      return matchText && c.status === statusFilter;
    })
    .sort((a, b) => {
      if (statusFilter === "completed" || statusFilter === "all") {
        if ((b.scorePct || 0) !== (a.scorePct || 0)) return (b.scorePct || 0) - (a.scorePct || 0);
      }
      return 0;
    });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
        <span className="text-xs font-bold text-zinc-500">Loading AI Interview Details...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-6 font-sans bg-zinc-50/50 min-h-screen text-left sh-animate-in">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
            <button onClick={handleReturn} className="hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <ChevronRight className="h-3 w-3 text-zinc-400" />
            <span className="text-zinc-700 font-bold">{jobTitle}</span>
            <ChevronRight className="h-3 w-3 text-zinc-400" />
            <span className="text-blue-600 font-bold">AI Interview Details</span>
          </div>

          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-blue-600" />
            AI Interview Details
          </h1>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href={`/recruiter/pipeline?jobId=${jobId}`}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Layers className="h-4 w-4 text-blue-400" /> Full Hiring Pipeline
          </Link>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Candidates</span>
          <span className="text-2xl font-black text-zinc-900">{totalCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Pending</span>
          <span className="text-2xl font-black text-zinc-600">{pendingCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Scheduled</span>
          <span className="text-2xl font-black text-amber-600">{scheduledCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">In Progress</span>
          <span className="text-2xl font-black text-blue-600">{inProgressCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Processing</span>
          <span className="text-2xl font-black text-purple-600">{processingCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Completed</span>
          <span className="text-2xl font-black text-emerald-600">{completedList.length}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Average Score</span>
          <span className="text-2xl font-black text-blue-600">{averageScore !== null ? `${averageScore}%` : "—"}</span>
        </div>
      </div>

      {/* Top N Candidate Advancement Controls */}
      <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-5 rounded-3xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 block mb-1">
            Authoritative Pipeline Ranking
          </span>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            Advance Highest-Ranked Candidates to Recruiter Final Interview
          </h2>
          <p className="text-xs text-zinc-300 font-medium mt-0.5">
            {eligibleUnadvancedCandidates.length} eligible completed candidates ready for ranking advancement.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-2xl">
            <span className="text-xs font-bold text-zinc-200">Top</span>
            <select
              value={advanceCount}
              onChange={(e) => setAdvanceCount(Number(e.target.value))}
              disabled={eligibleUnadvancedCandidates.length === 0}
              className="bg-zinc-900 text-white font-black text-xs px-2 py-1 rounded-xl border border-white/20 focus:outline-none"
            >
              {eligibleUnadvancedCandidates.length === 0 ? (
                <option value={1}>0 Candidates</option>
              ) : (
                Array.from({ length: eligibleUnadvancedCandidates.length }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} Candidate{n > 1 ? "s" : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <Button
            onClick={() => setShowAdvanceConfirmModal(true)}
            disabled={eligibleUnadvancedCandidates.length === 0 || advancing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl shadow-lg gap-1.5"
          >
            {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            Advance Candidates
          </Button>
        </div>
      </div>

      {/* Roster Controls & Filters */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-300 text-xs font-medium focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-zinc-500 text-[11px]">Filter Status:</span>
            {["all", "completed", "advanced", "scheduled", "in_progress", "pending"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Candidate Roster Table */}
        {filteredCandidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">
            No candidates matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Rank</th>
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Completed Date</th>
                  <th className="p-3.5">Authoritative Score</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredCandidates.map((cand, idx) => {
                  const isCompleted = cand.status === "completed" || cand.status === "advanced";
                  const rankDisplay = isCompleted && cand.scorePct ? `#${idx + 1}` : "—";

                  return (
                    <tr key={cand.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-black text-indigo-600">{rankDisplay}</td>
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{cand.first_name} {cand.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{cand.email}</span>
                          {cand.attemptsHistory.length > 1 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md mt-0.5 border border-amber-200">
                              <History className="h-2.5 w-2.5" /> Attempt {cand.attemptCount} (Re-interview)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          cand.status === "advanced"
                            ? "bg-purple-100 text-purple-800 border-purple-300"
                            : cand.status === "completed"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : cand.status === "in_progress"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        }`}>
                          {cand.status === "advanced" ? "Advanced to Final Round" : cand.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">{cand.submittedAt || "—"}</td>
                      <td className="p-3.5">
                        {cand.evidenceStatus === "insufficient_evidence" ? (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            Insufficient Evidence
                          </span>
                        ) : cand.scorePct !== null ? (
                          <span className="text-base font-black text-blue-600">{cand.scorePct}%</span>
                        ) : (
                          <span className="text-zinc-400 font-medium">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        {cand.evaluation && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedResult(cand)}
                            className="text-[11px] font-bold h-7.5 px-3 border-zinc-300"
                          >
                            <Eye className="h-3 w-3 mr-1 text-zinc-500" /> View Result
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReinterviewCandidate(cand);
                            setReinterviewDuration(60);
                            const nextDate = new Date();
                            nextDate.setDate(nextDate.getDate() + 1);
                            setReinterviewTime(nextDate.toISOString().slice(0, 16));
                          }}
                          className="text-[11px] font-bold h-7.5 px-2.5 border-zinc-300 hover:bg-zinc-100"
                        >
                          <RefreshCw className="h-3 w-3 text-amber-600 mr-1" /> Re-interview
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top N Confirmation Modal */}
      {showAdvanceConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs sh-animate-in">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-left">
            <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 text-white relative">
              <button onClick={() => setShowAdvanceConfirmModal(false)} className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
                <TrendingUp className="h-4 w-4" /> Top N Pipeline Advancement
              </div>
              <h2 className="text-xl font-black tracking-tight">Advance Top {selectedTopNPreview.length} Candidates</h2>
              <p className="text-xs text-zinc-300 mt-1">
                The highest-ranked candidates from the AI Interview round will advance to the Recruiter Final Interview stage.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-2">
                <span className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] block">
                  Ranked Candidates to Advance ({selectedTopNPreview.length})
                </span>
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {selectedTopNPreview.map((cand, i) => (
                    <div key={cand.id} className="p-3 bg-zinc-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-indigo-600 text-xs">#{i + 1}</span>
                        <div>
                          <span className="font-bold text-zinc-900 block">{cand.first_name} {cand.last_name}</span>
                          <span className="text-[10px] text-zinc-400">{cand.email}</span>
                        </div>
                      </div>
                      <span className="font-black text-blue-600 text-sm">{cand.scorePct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <Button variant="outline" onClick={() => setShowAdvanceConfirmModal(false)} className="font-bold text-xs">Cancel</Button>
                <Button
                  onClick={handleConfirmAdvanceTopN}
                  disabled={advancing}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs gap-1.5 shadow-sm px-5"
                >
                  {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                  {advancing ? "Advancing..." : `Confirm Advance Top ${selectedTopNPreview.length}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Re-interview Modal */}
      {reinterviewCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs sh-animate-in">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-left">
            <div className="bg-gradient-to-r from-zinc-900 via-amber-950 to-zinc-900 p-6 text-white relative">
              <button onClick={() => setReinterviewCandidate(null)} className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
                <RefreshCw className="h-4 w-4" /> Authorized Re-interview
              </div>
              <h2 className="text-xl font-black tracking-tight">Schedule Re-interview</h2>
              <p className="text-xs text-zinc-300 mt-0.5">{reinterviewCandidate.first_name} {reinterviewCandidate.last_name}</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-[11px] leading-relaxed font-medium">
                This will create a new AI Interview attempt for this candidate. The previous interview evaluation will remain stored in the candidate&apos;s assessment history for auditability.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={reinterviewTime}
                    onChange={(e) => setReinterviewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={reinterviewDuration}
                    onChange={(e) => setReinterviewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Focus Topics / Instructions</label>
                <textarea
                  value={reinterviewTopics}
                  onChange={(e) => setReinterviewTopics(e.target.value)}
                  placeholder="Additional focus areas for this re-interview attempt..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-amber-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <Button variant="outline" onClick={() => setReinterviewCandidate(null)} className="font-bold text-xs">Cancel</Button>
                <Button
                  onClick={handleScheduleReinterview}
                  disabled={reinterviewing}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs gap-1.5 shadow-sm px-5"
                >
                  {reinterviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {reinterviewing ? "Scheduling..." : "Schedule Re-interview"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Evaluation Result Viewer Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs sh-animate-in">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden text-left max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 text-white relative shrink-0">
              <button onClick={() => setSelectedResult(null)} className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                AI Conversational Evaluation Report
              </span>
              <h2 className="text-xl font-black">{selectedResult.first_name} {selectedResult.last_name}</h2>
              <p className="text-xs text-zinc-300">{selectedResult.email} • Position: {jobTitle}</p>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              {/* Score Header Card */}
              <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Authoritative Overall Score</span>
                  <span className="text-3xl font-black text-blue-600">{selectedResult.scorePct ?? 0}%</span>
                </div>
                {selectedResult.attemptsHistory.length > 1 && (
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Attempt History</span>
                    <div className="flex gap-1.5">
                      {selectedResult.attemptsHistory.map((att) => (
                        <span key={att.attemptNumber} className="px-2 py-0.5 rounded-md bg-zinc-200 text-zinc-800 text-[10px] font-bold">
                          Attempt #{att.attemptNumber}: {att.score}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Competency Rubric */}
              {selectedResult.evaluation && (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-zinc-900 uppercase text-[11px] tracking-wider">Competency Breakdown</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-0.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Technical Competence</span>
                      <span className="text-base font-black text-blue-600">{selectedResult.evaluation.technicalCompetence?.score || 0}%</span>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-0.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Problem Solving</span>
                      <span className="text-base font-black text-emerald-600">{selectedResult.evaluation.problemSolving?.score || 0}%</span>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-0.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Communication</span>
                      <span className="text-base font-black text-purple-600">{selectedResult.evaluation.communication?.score || 0}%</span>
                    </div>
                  </div>

                  {selectedResult.evaluation.summary && (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-1">
                      <span className="font-bold text-zinc-800 text-[11px] uppercase block">Evaluation Summary</span>
                      <p className="text-zinc-600 leading-relaxed font-medium">{selectedResult.evaluation.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript Preview */}
              {selectedResult.transcript && selectedResult.transcript.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-extrabold text-zinc-900 uppercase text-[11px] tracking-wider">Interview Transcript</h4>
                  <div className="bg-zinc-900 text-zinc-200 p-4 rounded-2xl space-y-3 font-mono text-[11px] max-h-48 overflow-y-auto">
                    {selectedResult.transcript.map((t, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <span className={`font-bold text-[10px] block uppercase ${t.speaker === "interviewer" ? "text-blue-400" : "text-emerald-400"}`}>
                          {t.speaker === "interviewer" ? "AI Interviewer" : "Candidate"}
                        </span>
                        <p className="text-zinc-300 leading-relaxed">{t.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
