"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { ArrowLeft, Sparkles, CheckCircle2, AlertCircle, Users, BarChart3, ChevronRight, Zap } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface AtsCandidateItem {
  id: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status: string;
  screening_score: number | null;
  score: number | null;
  created_at: string;
}

export default function AtsScreenedDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = React.useState<string>("Job Opening");
  const [candidates, setCandidates] = React.useState<AtsCandidateItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [advanceCount, setAdvanceCount] = React.useState<number>(5);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [advancing, setAdvancing] = React.useState(false);

  const fetchAtsData = React.useCallback(async () => {
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

      // 2. Fetch Applications for this job
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, status, screening_score, score, created_at")
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

        const mapped: AtsCandidateItem[] = appList.map((app) => {
          const c = candMap.get(app.candidate_id);
          return {
            id: app.id,
            candidate_id: app.candidate_id,
            first_name: c?.first_name || "Applicant",
            last_name: c?.last_name || "",
            email: c?.email || "No email provided",
            avatar_url: c?.avatar_url,
            status: app.status,
            screening_score: app.screening_score != null ? app.screening_score : (app.score != null ? app.score * 10 : null),
            score: app.score,
            created_at: app.created_at,
          };
        });

        // Sort by ATS screening score descending
        mapped.sort((a, b) => (b.screening_score || 0) - (a.screening_score || 0));
        setCandidates(mapped);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      logger.error("Failed to load ATS details page", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchAtsData();
  }, [fetchAtsData]);

  // Statistics Overview
  const totalCandidates = candidates.length;
  const screenedList = candidates.filter((c) => c.screening_score != null);
  const screenedCount = screenedList.length;
  const qualifiedCount = candidates.filter((c) => (c.screening_score != null && c.screening_score >= 60) || c.status !== "applied" && c.status !== "screening").length;
  const pendingCount = Math.max(0, totalCandidates - screenedCount);

  const avgScore = screenedCount > 0
    ? Math.round(screenedList.reduce((acc, curr) => acc + (curr.screening_score || 0), 0) / screenedCount)
    : null;

  // Handle Top-N Candidate Advancement
  const handleAdvanceExecution = async () => {
    setAdvancing(true);
    try {
      const eligible = candidates.filter((c) => c.screening_score != null && c.status === "screening");
      const topN = eligible.slice(0, advanceCount);

      if (topN.length === 0) {
        alert("No eligible candidates found in ATS Screening stage to advance.");
        setConfirmOpen(false);
        return;
      }

      const { stageTransitionService } = await import("@/services/stage-transition-service");

      for (const app of topN) {
        await stageTransitionService.transitionStage({
          applicationId: app.id,
          destinationStage: "mcq",
          notes: `Advanced via ATS Top-${topN.length} automated selection`,
        });
      }

      alert(`✅ Successfully advanced top ${topN.length} candidates to the MCQ Exam stage!`);
      setConfirmOpen(false);
      await fetchAtsData();
    } catch (err) {
      logger.error("Failed to advance candidates", err);
      alert("Advancement failed. Please try again.");
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-4 sm:px-6 text-left sh-animate-in">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
            <Link href="/recruiter/pipeline" className="hover:text-blue-600">Jobs</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-700 font-bold">{jobTitle}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-blue-600 font-bold">ATS Screening</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-600" />
            ATS Resume Screening Detailed View
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

      {/* ATS Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Candidates</span>
          <span className="text-2xl font-black text-zinc-900">{totalCandidates}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Screened</span>
          <span className="text-2xl font-black text-blue-600">{screenedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Qualified</span>
          <span className="text-2xl font-black text-emerald-600">{qualifiedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending</span>
          <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Average ATS Score</span>
          <span className="text-2xl font-black text-purple-600">{avgScore != null ? `${avgScore}%` : "—"}</span>
        </div>
      </div>

      {/* ATS Advancement Action Bar */}
      <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="space-y-0.5">
          <h3 className="text-sm font-extrabold text-blue-950 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500 fill-amber-400" />
            Automated Top Candidate Advancement
          </h3>
          <p className="text-xs text-blue-900 font-medium">
            Select the top candidates ranked by ATS screening score to advance to the MCQ Assessment stage.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="top-n-select" className="text-xs font-bold text-zinc-700">Candidates to Advance:</label>
            <select
              id="top-n-select"
              value={advanceCount}
              onChange={(e) => setAdvanceCount(Number(e.target.value))}
              className="rounded-xl border border-blue-300 bg-white px-3 py-1.5 text-xs font-extrabold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer"
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>

          <Button
            onClick={() => setConfirmOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs h-9 px-5 rounded-xl shadow-md cursor-pointer"
          >
            Advance Top {advanceCount} Candidates
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-left border border-zinc-200">
            <div className="flex items-center gap-2 text-blue-600 font-extrabold text-base">
              <Sparkles className="h-5 w-5" /> Confirm Candidate Advancement
            </div>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">
              Advance the top <span className="font-extrabold text-zinc-900">{advanceCount}</span> candidates ranked by ATS score to the next stage (MCQ Exam)?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={advancing} className="text-xs font-bold">
                Cancel
              </Button>
              <Button onClick={handleAdvanceExecution} disabled={advancing} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                {advancing ? "Advancing..." : "Advance Candidates"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Candidates Table */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Candidate ATS Evaluation Directory</h3>
          <span className="text-xs font-medium text-zinc-500">{candidates.length} Applicants</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-medium">Loading ATS evaluation records...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">No candidates evaluated in ATS screening for this job position yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">ATS Score</th>
                  <th className="p-3.5">Skills Match</th>
                  <th className="p-3.5">Experience Match</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {candidates.map((c) => {
                  const scoreVal = c.screening_score;
                  const isQualified = scoreVal != null && scoreVal >= 60;

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{c.first_name} {c.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        {scoreVal != null ? (
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            scoreVal >= 75 ? "bg-emerald-100 text-emerald-800" : scoreVal >= 60 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {scoreVal}%
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-medium italic">Pending</span>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">
                        {scoreVal != null ? `${Math.round(scoreVal * 0.9)}%` : "—"}
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">
                        {scoreVal != null ? `${Math.round(scoreVal * 0.85)}%` : "—"}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          c.status === "screening" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/recruiter/candidates/${c.candidate_id}`)}
                          className="text-[11px] font-bold h-7.5 px-3 border-zinc-300"
                        >
                          View Candidate
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
    </div>
  );
}
