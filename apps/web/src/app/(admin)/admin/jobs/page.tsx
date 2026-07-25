"use client";

import * as React from "react";
import {
  Briefcase,
  Search,
  Loader2,
  Building,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface JobItem {
  id: string;
  title: string;
  status: string;
  type: string;
  location?: string | null;
  category?: string | null;
  created_at: string;
  company_name: string;
  recruiter_name: string;
  appsCount: number;
}

export default function AdminJobsPage() {
  const [loading, setLoading] = React.useState(true);
  const [jobs, setJobs] = React.useState<JobItem[]>([]);
  const [search, setSearch] = React.useState("");

  const fetchJobs = React.useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: jobData, error: jobErr } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, status, type, location, category, company_id, recruiter_id, created_at")
        .order("created_at", { ascending: false });

      if (jobErr) throw jobErr;

      const { data: compData } = await supabase
        .schema("organization")
        .from("companies")
        .select("id, name");
      const compMap: Record<string, string> = {};
      (compData || []).forEach((c) => { compMap[c.id] = c.name; });

      const { data: recData } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("id, first_name, last_name");
      const recMap: Record<string, string> = {};
      (recData || []).forEach((r) => { recMap[r.id] = `${r.first_name || "Recruiter"} ${r.last_name || ""}`.trim(); });

      const { data: appData } = await supabase
        .schema("application")
        .from("applications")
        .select("job_id");
      const appCounts: Record<string, number> = {};
      (appData || []).forEach((a) => {
        if (a.job_id) appCounts[a.job_id] = (appCounts[a.job_id] || 0) + 1;
      });

      const list: JobItem[] = (jobData || []).map((j) => ({
        ...j,
        company_name: j.company_id ? compMap[j.company_id] || "Organization" : "Independent",
        recruiter_name: j.recruiter_id ? recMap[j.recruiter_id] || "Team Member" : "Hiring Lead",
        appsCount: appCounts[j.id] || 0,
      }));

      setJobs(list);
    } catch (err) {
      logger.error("Failed to load jobs for admin", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return j.title.toLowerCase().includes(q) || j.company_name.toLowerCase().includes(q) || (j.category || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
            Platform Recruitment Postings
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-0.5">
            Global Jobs Inventory
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Inspect all active, draft, and completed job postings across registered organization clients.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job title, company..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Jobs Table */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Recruiter Lead</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Applicants</th>
                  <th className="py-3 px-4 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-zinc-900">
                      <div>
                        <p>{j.title}</p>
                        <p className="text-[10px] text-zinc-400 font-normal">{j.location || "Remote"}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-blue-600">{j.company_name}</td>
                    <td className="py-3.5 px-4 text-zinc-700">{j.recruiter_name}</td>
                    <td className="py-3.5 px-4 text-zinc-600">{j.category || "Engineering"}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-zinc-900">{j.appsCount} Candidates</td>
                    <td className="py-3.5 px-4 text-right text-zinc-500 text-[11px]">
                      {new Date(j.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}

                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400 text-xs italic font-medium">
                      No jobs found matching filter criteria.
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
