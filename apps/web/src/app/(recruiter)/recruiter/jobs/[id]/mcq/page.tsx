"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { ArrowLeft, Sparkles, ChevronRight, BarChart3, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface McqCandidateItem {
  id: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status: string;
  mcq_score: number | null;
  coding_score: number | null;
  created_at: string;
}

export default function McqExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = React.useState<string>("Job Opening");
  const [candidates, setCandidates] = React.useState<McqCandidateItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchMcqData = React.useCallback(async () => {
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

      // 2. Fetch Applications for this job in MCQ stage or beyond
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, status, mcq_score, coding_score, created_at")
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

        const mapped: McqCandidateItem[] = appList.map((app) => {
          const c = candMap.get(app.candidate_id);
          return {
            id: app.id,
            candidate_id: app.candidate_id,
            first_name: c?.first_name || "Applicant",
            last_name: c?.last_name || "",
            email: c?.email || "No email provided",
            avatar_url: c?.avatar_url,
            status: app.status,
            mcq_score: app.mcq_score,
            coding_score: app.coding_score,
            created_at: app.created_at,
          };
        });

        // Filter relevant MCQ candidates
        const mcqCandidates = mapped.filter((m) => m.status === "mcq" || m.mcq_score != null || ["coding", "interview", "zoom_interview", "offer_sent", "offered"].includes(m.status));
        mcqCandidates.sort((a, b) => (b.mcq_score || 0) - (a.mcq_score || 0));
        setCandidates(mcqCandidates);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      logger.error("Failed to load MCQ details page", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchMcqData();
  }, [fetchMcqData]);

  // Statistics Overview
  const totalCandidates = candidates.length;
  const completedList = candidates.filter((c) => c.mcq_score != null);
  const completedCount = completedList.length;
  const pendingCount = Math.max(0, totalCandidates - completedCount);

  const scores = completedList.map((c) => c.mcq_score).filter((s): s is number => s != null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const highestScore = scores.length > 0 ? Math.max(...scores) : null;

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
            <span className="text-blue-600 font-bold">MCQ Assessment</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            MCQ Screening Exam Detailed View
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

      {/* MCQ Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Candidates</span>
          <span className="text-2xl font-black text-zinc-900">{totalCandidates}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Completed</span>
          <span className="text-2xl font-black text-emerald-600">{completedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending</span>
          <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Average Score</span>
          <span className="text-2xl font-black text-blue-600">{avgScore != null ? `${avgScore}%` : "—"}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Highest Score</span>
          <span className="text-2xl font-black text-purple-600">{highestScore != null ? `${highestScore}%` : "—"}</span>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">MCQ Candidate Scorecard</h3>
          <span className="text-xs font-medium text-zinc-500">{candidates.length} Evaluated Candidates</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-medium">Loading MCQ exam results...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">No candidates in MCQ exam round for this job posting yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">Exam Status</th>
                  <th className="p-3.5">Score</th>
                  <th className="p-3.5">Correct Answers</th>
                  <th className="p-3.5">Completed At</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {candidates.map((c) => {
                  const scoreVal = c.mcq_score;
                  const isDone = scoreVal != null;

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{c.first_name} {c.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isDone ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {isDone ? "Completed" : "Pending Exam"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {scoreVal != null ? (
                          <span className="font-extrabold text-zinc-900 text-sm">{scoreVal}%</span>
                        ) : (
                          <span className="text-zinc-400 font-medium italic">—</span>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">
                        {scoreVal != null ? `${Math.round((scoreVal / 100) * 10)} / 10` : "—"}
                      </td>
                      <td className="p-3.5 text-zinc-500 font-medium">
                        {isDone ? new Date(c.created_at).toLocaleDateString() : "Not started"}
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/recruiter/candidates/${c.candidate_id}`)}
                          className="text-[11px] font-bold h-7.5 px-3 border-zinc-300"
                        >
                          View Result
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
