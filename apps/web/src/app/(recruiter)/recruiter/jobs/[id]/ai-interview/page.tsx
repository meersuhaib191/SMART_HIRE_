"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  Download
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface CandidateInterviewItem {
  id: string; // application_id
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  scorePct: number | null;
  score10: number | null;
  attemptId?: string;
  submittedAt?: string;
  timeSpentSeconds?: number;
  evaluation?: any;
  transcript?: any[];
}

export default function RecruiterAIInterviewDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [jobTitle, setJobTitle] = React.useState("Job Posting");
  const [candidates, setCandidates] = React.useState<CandidateInterviewItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [selectedResult, setSelectedResult] = React.useState<CandidateInterviewItem | null>(null);

  // Scheduling Modal State
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [scheduleTime, setScheduleTime] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [scheduling, setScheduling] = React.useState(false);

  // Advancement State
  const [advanceCount, setAdvanceCount] = React.useState(1);
  const [advancing, setAdvancing] = React.useState(false);

  const supabase = createClient();

  const handleReturn = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/recruiter/jobs/${jobId}/applications`);
    }
  };

  const fetchInterviewData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Job info with schema fallbacks
      let job: any = null;
      const { data: jobSchemaData } = await supabase
        .schema("job")
        .from("jobs")
        .select("title, company_id")
        .eq("id", jobId)
        .maybeSingle();

      job = jobSchemaData;
      if (!job) {
        const { data: jobPublicData } = await supabase
          .from("jobs")
          .select("title, company_id")
          .eq("id", jobId)
          .maybeSingle();
        job = jobPublicData;
      }

      if (job?.title) setJobTitle(job.title);

      // 2. Fetch Applications for this job with schema fallbacks
      let apps: any[] = [];
      const { data: appsPublicData } = await supabase
        .from("applications")
        .select("id, candidate_id, status, ai_interview_score, updated_at")
        .eq("job_id", jobId);

      apps = appsPublicData || [];
      if (apps.length === 0) {
        const { data: appsSchemaData } = await supabase
          .schema("application")
          .from("applications")
          .select("id, candidate_id, status, ai_interview_score, updated_at")
          .eq("job_id", jobId);
        apps = appsSchemaData || [];
      }

      if (apps.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      // 3. Fetch Candidate Profiles with schema fallbacks
      const candidateIds = apps.map((a) => a.candidate_id);
      let profiles: any[] = [];

      const { data: candSchemaData } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, first_name, last_name, email")
        .in("id", candidateIds);

      profiles = candSchemaData || [];
      if (profiles.length === 0) {
        const { data: candPublicData } = await supabase
          .from("candidates")
          .select("id, first_name, last_name, email")
          .in("id", candidateIds);
        profiles = candPublicData || [];
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // 4. Fetch Assignments & Attempts
      const appIds = apps.map((a) => a.id);
      let assignments: any[] = [];

      const { data: assignSchemaData } = await supabase
        .schema("assessment")
        .from("assignments")
        .select("id, application_id, assessment_id, status")
        .in("application_id", appIds)
        .eq("type", "ai_interview");

      assignments = assignSchemaData || [];
      if (assignments.length === 0) {
        const { data: assignPublicData } = await supabase
          .from("assignments")
          .select("id, application_id, assessment_id, status")
          .in("application_id", appIds)
          .eq("type", "ai_interview");
        assignments = assignPublicData || [];
      }

      const assignMap = new Map(assignments.map((a) => [a.application_id, a]));

      const assignIds = assignments.map((a) => a.id);
      let attemptMap = new Map();
      if (assignIds.length > 0) {
        let attempts: any[] = [];
        const { data: attSchemaData } = await supabase
          .schema("assessment")
          .from("attempts")
          .select("*")
          .in("assignment_id", assignIds);

        attempts = attSchemaData || [];
        if (attempts.length === 0) {
          const { data: attPublicData } = await supabase
            .from("attempts")
            .select("*")
            .in("assignment_id", assignIds);
          attempts = attPublicData || [];
        }

        attemptMap = new Map(attempts.map((att) => [att.assignment_id, att]));
      }

      const mapped: CandidateInterviewItem[] = apps.map((app) => {
        const profile = profileMap.get(app.candidate_id) || { first_name: "Candidate", last_name: "", email: "" };
        const assign = assignMap.get(app.id);
        const att = assign ? attemptMap.get(assign.id) : null;

        let scorePct = app.ai_interview_score !== null && app.ai_interview_score !== undefined
          ? Math.round(app.ai_interview_score * 10)
          : null;

        if (scorePct === null && att?.score !== undefined) {
          scorePct = Math.round(att.score);
        }

        const score10 = scorePct !== null ? Math.round((scorePct / 10) * 10) / 10 : null;

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          status: att?.status === "completed" ? "completed" : (assign ? "scheduled" : "pending"),
          scorePct,
          score10,
          attemptId: att?.id,
          submittedAt: att?.completed_at ? new Date(att.completed_at).toLocaleDateString() : undefined,
          timeSpentSeconds: att?.time_spent_seconds,
          evaluation: att?.answers?.evaluation,
          transcript: att?.answers?.transcript,
        };
      });

      setCandidates(mapped);
    } catch (err) {
      logger.error("Error fetching recruiter AI interview data", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchInterviewData();
  }, [jobId]);

  // Handle Schedule AI Interview
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setScheduling(true);
      const appIds = candidates.map((c) => c.id);
      const res = await fetch(`/api/recruiter/jobs/${jobId}/schedule-ai-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationIds: appIds,
          scheduledStartAt: scheduleTime || new Date().toISOString(),
          durationMinutes: durationMinutes || 60,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule AI Interview");

      setShowScheduleModal(false);
      await fetchInterviewData();
    } catch (err: any) {
      alert(`Scheduling error: ${err.message}`);
    } finally {
      setScheduling(false);
    }
  };

  // Handle Advancement
  const handleAdvanceCandidates = async () => {
    try {
      setAdvancing(true);
      const completedCandidates = candidates
        .filter((c) => c.status === "completed" && c.scorePct !== null)
        .sort((a, b) => (b.scorePct ?? 0) - (a.scorePct ?? 0));

      if (completedCandidates.length === 0) {
        alert("No completed AI Interview submissions available to advance.");
        return;
      }

      const topToAdvance = completedCandidates.slice(0, advanceCount);
      for (const c of topToAdvance) {
        await supabase
          .from("applications")
          .update({ status: "final_interview", updated_at: new Date().toISOString() })
          .eq("id", c.id);
      }

      await fetchInterviewData();
      alert(`Successfully advanced top ${topToAdvance.length} candidate(s) to Final Interview!`);
    } catch (err: any) {
      alert(`Advancement error: ${err.message}`);
    } finally {
      setAdvancing(false);
    }
  };

  const completedList = candidates.filter((c) => c.status === "completed");
  const scheduledCount = candidates.filter((c) => c.status === "scheduled").length;

  const validScores = completedList.map((c) => c.scorePct!).filter((s) => s !== null);
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null;

  const filteredCandidates = candidates.filter((c) =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs text-zinc-500 font-bold mt-3">Loading AI Interview Details...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 font-sans bg-zinc-50/50 min-h-screen text-left">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="space-y-1">
          <button
            onClick={handleReturn}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Job Applications
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-2xl border border-blue-200">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">Recruiter Dashboard</span>
              <h1 className="text-2xl font-black text-zinc-900">{jobTitle} — AI Live Interview Round</h1>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-blue-400" /> Schedule AI Interview
          </button>

          <Link
            href={`/recruiter/pipeline?jobId=${jobId}`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Layers className="h-4 w-4" /> Open Full Kanban Board
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Assigned Candidates</span>
          <p className="text-2xl font-black text-zinc-900">{candidates.length}</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Completed Interviews</span>
          <p className="text-2xl font-black text-emerald-600">{completedList.length}</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Scheduled / Pending</span>
          <p className="text-2xl font-black text-amber-600">{scheduledCount}</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Average Interview Score</span>
          <p className="text-2xl font-black text-blue-600">{avgScore !== null ? `${avgScore}%` : "—"}</p>
        </div>
      </div>

      {/* Roster & Advancement Controls */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-zinc-900">Candidate Roster & Results</h3>
            <p className="text-xs text-zinc-500 font-medium">Inspect conversational transcripts, 5-dimension rubric scores, and question evidence.</p>
          </div>

          {/* Candidate Advancement Control */}
          <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border border-zinc-200">
            <span className="text-xs font-bold text-zinc-600">Candidates to Advance:</span>
            <select
              value={advanceCount}
              onChange={(e) => setAdvanceCount(Number(e.target.value))}
              className="bg-white border border-zinc-300 rounded-lg text-xs font-bold px-2.5 py-1 text-zinc-800 outline-none"
            >
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={handleAdvanceCandidates}
              disabled={advancing || completedList.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              <span>Advance Candidates</span>
            </button>
          </div>
        </div>

        {/* Candidate Table */}
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs italic font-medium">
            No candidate records found for this AI Interview round.
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Time Spent</th>
                  <th className="p-4">Overall Score</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-extrabold text-sm text-zinc-900">{c.first_name} {c.last_name}</p>
                        <p className="text-[11px] text-zinc-500 font-medium">{c.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        c.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {c.status === "completed" ? "Completed" : "Scheduled / Pending"}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-zinc-700">
                      {c.timeSpentSeconds ? `${Math.floor(c.timeSpentSeconds / 60)}m ${c.timeSpentSeconds % 60}s` : "—"}
                    </td>
                    <td className="p-4">
                      {c.scorePct !== null ? (
                        <span className={`font-extrabold text-sm ${c.scorePct >= 60 ? "text-emerald-600" : "text-rose-600"}`}>
                          {c.scorePct}% ({c.score10}/10)
                        </span>
                      ) : (
                        <span className="text-zinc-400 font-medium">Pending</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {c.status === "completed" ? (
                        <button
                          onClick={() => setSelectedResult(c)}
                          className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Result
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-xs italic font-medium">Awaiting Session</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule AI Interview Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleScheduleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 text-left space-y-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">AI Interview Round</span>
                <h2 className="text-lg font-extrabold text-white">Schedule AI Live Interview</h2>
              </div>
              <button type="button" onClick={() => setShowScheduleModal(false)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-300 block">Interview Start Date & Time *</label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-blue-500 font-sans"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-zinc-300 block">Interview Duration (Minutes)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-blue-500 font-sans font-bold"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes (Default)</option>
                  <option value={90}>90 Minutes</option>
                </select>
                <p className="text-[10px] text-zinc-500">Defaults to 60 minutes server-authoritative timer if unspecified.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-3 rounded-xl border border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduling}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detailed Result Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
              <div>
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">AI Live Interview Evaluation Report</span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">{selectedResult.first_name} {selectedResult.last_name}</h2>
                <p className="text-xs text-zinc-400 font-medium">{selectedResult.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedResult.attemptId && (
                  <a
                    href={`/api/assessments/${selectedResult.attemptId}/interview-transcript/pdf`}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-sm transition-all"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF Transcript
                  </a>
                )}
                <button onClick={() => setSelectedResult(null)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-zinc-200">
              {/* Score Breakdown Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Overall Score</span>
                  <span className="text-2xl font-black text-blue-400">{selectedResult.scorePct}%</span>
                </div>
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Time Spent</span>
                  <span className="text-xl font-extrabold text-white">{selectedResult.timeSpentSeconds ? `${Math.floor(selectedResult.timeSpentSeconds / 60)}m` : "—"}</span>
                </div>
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Status</span>
                  <span className="text-xl font-extrabold text-emerald-400">Completed</span>
                </div>
              </div>

              {/* Rubric Breakdown */}
              {selectedResult.evaluation && (
                <div className="space-y-3 bg-zinc-950 p-5 rounded-2xl border border-zinc-800">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> 5-Dimension Competency Rubric
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 font-bold block">Tech (40%)</span>
                      <span className="text-sm font-extrabold text-blue-400">{selectedResult.evaluation.technicalCompetence?.score}%</span>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 font-bold block">Prob Solving (20%)</span>
                      <span className="text-sm font-extrabold text-emerald-400">{selectedResult.evaluation.problemSolving?.score}%</span>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 font-bold block">Comm (15%)</span>
                      <span className="text-sm font-extrabold text-amber-400">{selectedResult.evaluation.communication?.score}%</span>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 font-bold block">Experience (15%)</span>
                      <span className="text-sm font-extrabold text-indigo-400">{selectedResult.evaluation.appliedExperience?.score}%</span>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                      <span className="text-[9px] text-zinc-400 font-bold block">Judgment (10%)</span>
                      <span className="text-sm font-extrabold text-purple-400">{selectedResult.evaluation.professionalJudgment?.score}%</span>
                    </div>
                  </div>
                  {selectedResult.evaluation.summary && (
                    <p className="text-xs text-zinc-300 leading-relaxed pt-2 border-t border-zinc-800">{selectedResult.evaluation.summary}</p>
                  )}
                </div>
              )}

              {/* Conversational Transcript */}
              {selectedResult.transcript && selectedResult.transcript.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" /> Complete Conversational Transcript
                  </h3>
                  <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3 max-h-64 overflow-y-auto text-xs">
                    {selectedResult.transcript.map((t: any, idx: number) => (
                      <div key={idx} className={`p-2.5 rounded-xl border ${t.speaker === 'interviewer' ? 'bg-blue-950/20 border-blue-500/20' : 'bg-zinc-900 border-zinc-800 ml-4'}`}>
                        <span className={`font-bold uppercase text-[9px] block ${t.speaker === 'interviewer' ? 'text-blue-400' : 'text-emerald-400'}`}>
                          {t.speaker === 'interviewer' ? 'AI Interviewer' : `${selectedResult.first_name}`} &bull; [{t.timeFormatted}]
                        </span>
                        <p className="text-zinc-200 mt-1">{t.text}</p>
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
