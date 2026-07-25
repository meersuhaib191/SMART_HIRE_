"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  Search,
  Loader2,
  Building,
  Briefcase,
  Layers,
  Award,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface ApplicationRow {
  id: string;
  status: string;
  screening_score?: number | null;
  mcq_score?: number | null;
  coding_score?: number | null;
  interview_avg_score?: number | null;
  created_at: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  company_name: string;
}

export default function AdminApplicationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [applications, setApplications] = React.useState<ApplicationRow[]>([]);
  const [search, setSearch] = React.useState("");

  const fetchApplications = React.useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: appData, error: appErr } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, job_id, status, screening_score, mcq_score, coding_score, interview_avg_score, created_at")
        .order("created_at", { ascending: false });

      if (appErr) throw appErr;

      const { data: candData } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, first_name, last_name, email");
      const candMap: Record<string, { name: string; email: string }> = {};
      (candData || []).forEach((c) => {
        candMap[c.id] = {
          name: `${c.first_name || "Candidate"} ${c.last_name || ""}`.trim(),
          email: c.email || "",
        };
      });

      const { data: jobData } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, company_id");
      const jobMap: Record<string, { title: string; company_id?: string }> = {};
      (jobData || []).forEach((j) => { jobMap[j.id] = { title: j.title, company_id: j.company_id }; });

      const { data: compData } = await supabase
        .schema("organization")
        .from("companies")
        .select("id, name");
      const compMap: Record<string, string> = {};
      (compData || []).forEach((c) => { compMap[c.id] = c.name; });

      const list: ApplicationRow[] = (appData || []).map((a) => {
        const cand = candMap[a.candidate_id] || { name: "Candidate", email: "—" };
        const job = jobMap[a.job_id] || { title: "Job Opening" };
        const compName = job.company_id ? compMap[job.company_id] || "Organization" : "Organization";

        return {
          id: a.id,
          status: a.status,
          screening_score: a.screening_score,
          mcq_score: a.mcq_score,
          coding_score: a.coding_score,
          interview_avg_score: a.interview_avg_score,
          created_at: a.created_at,
          candidate_name: cand.name,
          candidate_email: cand.email,
          job_title: job.title,
          company_name: compName,
        };
      });

      setApplications(list);
    } catch (err) {
      logger.error("Failed to load applications for admin", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const filteredApplications = applications.filter((a) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return a.candidate_name.toLowerCase().includes(q) || a.job_title.toLowerCase().includes(q) || a.company_name.toLowerCase().includes(q) || a.status.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider block">
            Platform Application Submissions
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-0.5">
            Global Applications Pipeline
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Track candidate pipeline stages, stage scorecards, and final hiring statuses across all postings.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate, job, stage..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-900 focus:border-pink-600 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Target Job</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4 text-center">ATS Score</th>
                  <th className="py-3 px-4 text-center">MCQ</th>
                  <th className="py-3 px-4 text-center">Coding</th>
                  <th className="py-3 px-4 text-center">AI Interview</th>
                  <th className="py-3 px-4 text-right">Applied Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-900">
                      <p>{app.candidate_name}</p>
                      <p className="text-[10px] text-zinc-400 font-mono font-normal">{app.candidate_email}</p>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-800 font-bold">{app.job_title}</td>
                    <td className="py-3.5 px-4 font-bold text-blue-600">{app.company_name}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-zinc-900 text-white">
                        {app.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-800">
                      {app.screening_score != null ? `${app.screening_score}%` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-[#0071E3]">
                      {app.mcq_score != null ? `${app.mcq_score}%` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                      {app.coding_score != null ? `${app.coding_score}%` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-violet-600">
                      {app.interview_avg_score != null ? `${app.interview_avg_score}%` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right text-zinc-500 text-[11px]">
                      {new Date(app.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}

                {filteredApplications.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400 text-xs italic font-medium">
                      No applications found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
