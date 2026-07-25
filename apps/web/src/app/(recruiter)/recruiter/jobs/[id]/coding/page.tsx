"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Code,
  CheckCircle2,
  Clock,
  Award,
  Search,
  ChevronRight,
  FileCode,
  Sparkles,
  Loader2,
  Eye,
  Layers,
  X
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface CandidateCodingItem {
  id: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  scorePct: number | null;
  score10: number | null;
  language?: string;
  submittedAt?: string;
  passedCount?: number;
  totalCount?: number;
  code?: string;
  geminiResult?: any;
}

export default function RecruiterCodingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [jobTitle, setJobTitle] = React.useState("Job Posting");
  const [candidates, setCandidates] = React.useState<CandidateCodingItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [selectedResult, setSelectedResult] = React.useState<CandidateCodingItem | null>(null);

  const supabase = createClient();

  const handleReturn = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/recruiter/jobs/${jobId}/applications`);
    }
  };

  const fetchCodingData = React.useCallback(async () => {
    try {
      // 1. Fetch job title
      const { data: job } = await supabase
        .schema("job")
        .from("jobs")
        .select("title, coding_assessment_id")
        .eq("id", jobId)
        .maybeSingle();

      if (job) setJobTitle(job.title);

      // 2. Fetch applications for this job
      const { data: apps } = await supabase
        .from("applications")
        .select("id, candidate_id, status, coding_score, coding_passed")
        .eq("job_id", jobId)
        .is("deleted_at", null);

      if (!apps || apps.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      const candidateIds = apps.map((a) => a.candidate_id);
      const { data: candProfiles } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, first_name, last_name, email")
        .in("id", candidateIds);

      const candMap: Record<string, { first_name: string; last_name: string; email: string }> = {};
      (candProfiles || []).forEach((c) => {
        candMap[c.id] = { first_name: c.first_name, last_name: c.last_name, email: c.email };
      });

      // 3. Fetch assessment assignments & attempts for coding score details
      const { data: assignments } = await supabase
        .schema("assessment")
        .from("assignments")
        .select("id, application_id, candidate_id, status")
        .in("application_id", apps.map((a) => a.id));

      const assignIds = (assignments || []).map((a) => a.id);
      const { data: attempts } = await supabase
        .schema("assessment")
        .from("attempts")
        .select("id, assignment_id, score, passed, completed_at, answers")
        .in("assignment_id", assignIds);

      const attemptMap: Record<string, any> = {};
      (attempts || []).forEach((att) => {
        const assign = (assignments || []).find((a) => a.id === att.assignment_id);
        if (assign) {
          attemptMap[assign.application_id] = att;
        }
      });

      const mapped: CandidateCodingItem[] = apps.map((app) => {
        const profile = candMap[app.candidate_id] || { first_name: "Candidate", last_name: "", email: "candidate@email.com" };
        const att = attemptMap[app.id];

        let scorePct = app.coding_score !== null && app.coding_score !== undefined ? Math.round(app.coding_score * 10) : null;
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
          status: att ? "completed" : (app.status === "coding" ? "assigned" : app.status),
          scorePct,
          score10,
          language: att?.answers?.language || "python",
          submittedAt: att?.completed_at ? new Date(att.completed_at).toLocaleDateString() : undefined,
          passedCount: att?.answers?.passedCases ?? undefined,
          totalCount: att?.answers?.totalCases ?? undefined,
          code: att?.answers?.code || undefined,
          geminiResult: att?.answers?.geminiResult || att?.answers?.geminiEvaluation,
        };
      });

      setCandidates(mapped);
    } catch (err) {
      logger.error("Failed to fetch coding details for recruiter", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, supabase]);

  React.useEffect(() => {
    fetchCodingData();
  }, [fetchCodingData]);

  const completedList = candidates.filter((c) => c.status === "completed" || c.scorePct !== null);
  const pendingCount = candidates.length - completedList.length;
  const avgScore = completedList.length > 0
    ? Math.round(completedList.reduce((acc, c) => acc + (c.scorePct || 0), 0) / completedList.length)
    : null;

  const filteredCandidates = candidates.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(q) || c.email.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturn}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Return
          </button>
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Assessment Round Console</span>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 mt-0.5">{jobTitle} — Coding Assessment Details</h1>
          </div>
        </div>

        <Link
          href={`/recruiter/pipeline?jobId=${jobId}`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Layers className="h-4 w-4" /> Open Full Kanban Board
        </Link>
      </div>

      {/* Level-1 Round Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Assigned Candidates</span>
          <p className="text-2xl font-black text-zinc-900">{candidates.length}</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Completed Submissions</span>
          <p className="text-2xl font-black text-emerald-600">{completedList.length}</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Pending Attempts</span>
          <p className="text-2xl font-black text-amber-600">{pendingCount}</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Average Coding Score</span>
          <p className="text-2xl font-black text-blue-600">{avgScore !== null ? `${avgScore}%` : "—"}</p>
        </div>
      </div>

      {/* Roster & Detailed Results Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-zinc-900">Candidate Submissions</h3>
            <p className="text-xs text-zinc-500 font-medium">Inspect functional test case accuracy, runtime statistics, and AI code review.</p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate name..."
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs italic font-medium">
            No candidate submissions recorded for this coding assessment yet.
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Language</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Test Cases Passed</th>
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
                      <span className="inline-flex items-center font-mono font-bold text-xs bg-zinc-100 px-2.5 py-1 rounded-md text-zinc-700 border border-zinc-200 uppercase">
                        {c.language || "PYTHON"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        c.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {c.status === "completed" ? "Completed" : "Pending"}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-zinc-700">
                      {c.passedCount !== undefined && c.totalCount !== undefined ? `${c.passedCount} / ${c.totalCount}` : "—"}
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
                        <span className="text-zinc-400 text-xs italic font-medium">Awaiting Submission</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recruiter Detailed Coding Result Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl text-left overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
              <div>
                <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block">Detailed Candidate Assessment Result</span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">{selectedResult.first_name} {selectedResult.last_name}</h2>
                <p className="text-xs text-zinc-400 font-medium">{selectedResult.email} • Language: {selectedResult.language?.toUpperCase()}</p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
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
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Test Cases Passed</span>
                  <span className="text-2xl font-black text-emerald-400">{selectedResult.passedCount} / {selectedResult.totalCount}</span>
                </div>
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Code Quality Score</span>
                  <span className="text-2xl font-black text-purple-400">{selectedResult.geminiResult?.codeQuality != null ? `${selectedResult.geminiResult.codeQuality}%` : "—"}</span>
                </div>
              </div>

              {/* AI Code Review Details */}
              {selectedResult.geminiResult && (
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> AI Code Evaluation & Qualitative Feedback
                  </h3>
                  <div className="space-y-2 text-xs leading-relaxed text-zinc-300">
                    <p><strong>Code Quality & Structure:</strong> {selectedResult.geminiResult.codeQuality != null ? `${selectedResult.geminiResult.codeQuality}%` : "Pending"}</p>
                    {selectedResult.geminiResult.timeComplexity && (
                      <p><strong>Estimated Complexity:</strong> Time: {selectedResult.geminiResult.timeComplexity}, Space: {selectedResult.geminiResult.spaceComplexity || "—"}</p>
                    )}
                    {selectedResult.geminiResult.reasoning && (
                      <div className="mt-2 text-zinc-400 bg-zinc-900 p-3 rounded-xl border border-zinc-800/80">
                        {selectedResult.geminiResult.reasoning}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submitted Source Code Viewer */}
              {selectedResult.code && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-emerald-400" /> Candidate Submitted Source Code
                  </h3>
                  <pre className="bg-zinc-950 text-zinc-200 p-4 rounded-2xl border border-zinc-800 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
                    {selectedResult.code}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
