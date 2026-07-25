"use client";

import * as React from "react";
import {
  Briefcase,
  Search,
  Loader2,
  Building,
  FileSpreadsheet,
  CheckCircle2,
  Eye,
  X,
  UserCheck,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface RecruiterItem {
  id: string;
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  avatar_url?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  created_at: string;
  jobsCount: number;
}

interface ManagedJob {
  id: string;
  title: string;
  status: string;
  type: string;
  created_at: string;
}

export default function AdminRecruitersPage() {
  const [loading, setLoading] = React.useState(true);
  const [recruiters, setRecruiters] = React.useState<RecruiterItem[]>([]);
  const [search, setSearch] = React.useState("");

  // Modal State
  const [selectedRecruiter, setSelectedRecruiter] = React.useState<RecruiterItem | null>(null);
  const [managedJobs, setManagedJobs] = React.useState<ManagedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  const fetchRecruiters = React.useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: recData, error: recErr } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("id, user_id, company_id, role, first_name, last_name, email, phone, title, avatar_url, created_at")
        .order("created_at", { ascending: false });

      if (recErr) throw recErr;

      const { data: jobsData } = await supabase
        .schema("job")
        .from("jobs")
        .select("recruiter_id, company_id");

      const jobCounts: Record<string, number> = {};
      (jobsData || []).forEach((j) => {
        if (j.recruiter_id) jobCounts[j.recruiter_id] = (jobCounts[j.recruiter_id] || 0) + 1;
      });

      const { data: compData } = await supabase
        .schema("organization")
        .from("companies")
        .select("id, name");

      const compMap: Record<string, string> = {};
      (compData || []).forEach((c) => { compMap[c.id] = c.name; });

      const list: RecruiterItem[] = (recData || []).map((r) => ({
        ...r,
        company_name: r.company_id ? compMap[r.company_id] || "Organization" : "Independent",
        jobsCount: jobCounts[r.id] || 0,
      }));

      setRecruiters(list);
    } catch (err) {
      logger.error("Failed to load recruiters for admin", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRecruiters();
  }, [fetchRecruiters]);

  const handleOpenRecruiterModal = async (rec: RecruiterItem) => {
    setSelectedRecruiter(rec);
    setLoadingJobs(true);
    setManagedJobs([]);
    const supabase = createClient();

    try {
      const { data: jobs } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, status, type, created_at")
        .eq("recruiter_id", rec.id);

      setManagedJobs((jobs || []) as ManagedJob[]);
    } catch (err) {
      logger.error("Failed to load recruiter jobs", err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const filteredRecruiters = recruiters.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
    return name.includes(q) || (r.email || "").toLowerCase().includes(q) || (r.company_name || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider block">
            Platform Operations & Team Roles
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-0.5">
            Recruiters Directory
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Inspect registered recruiters, assigned hiring managers, and active company job postings.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recruiters by name, company..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-900 focus:border-violet-600 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Recruiters Table */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Recruiter Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Organization / Company</th>
                  <th className="py-3 px-4">Professional Title</th>
                  <th className="py-3 px-4">Jobs Managed</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredRecruiters.map((rec) => (
                  <tr key={rec.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        {rec.avatar_url ? (
                          <img src={rec.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-zinc-200 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {(rec.first_name || "R").charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-zinc-900">{rec.first_name || "Recruiter"} {rec.last_name || ""}</p>
                          <p className="text-[10px] text-zinc-400 font-normal">{rec.phone || "No phone listed"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-700 font-mono text-[11px]">{rec.email || "—"}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-blue-600 flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-blue-500" /> {rec.company_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600">{rec.title || "Talent Acquisition Lead"}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-bold text-[10px]">
                        <Briefcase className="h-3 w-3" /> {rec.jobsCount} Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                      {new Date(rec.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenRecruiterModal(rec)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detailed Report
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredRecruiters.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400 text-xs italic font-medium">
                      No recruiters found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recruiter Detailed Modal */}
      {selectedRecruiter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 space-y-5 text-left max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                {selectedRecruiter.avatar_url ? (
                  <img src={selectedRecruiter.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-zinc-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-violet-600 text-white font-extrabold text-lg flex items-center justify-center">
                    {(selectedRecruiter.first_name || "R").charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900">
                    {selectedRecruiter.first_name} {selectedRecruiter.last_name}
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    {selectedRecruiter.title || "Talent Acquisition Lead"} • {selectedRecruiter.company_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecruiter(null)}
                className="text-zinc-400 hover:text-zinc-700 h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Recruiter Managed Jobs */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-violet-600" /> Managed Job Postings & Openings
              </h4>

              {loadingJobs ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                </div>
              ) : managedJobs.length > 0 ? (
                <div className="space-y-2.5">
                  {managedJobs.map((j) => (
                    <div key={j.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-zinc-900">{j.title}</p>
                        <p className="text-[10px] text-zinc-500 font-medium">Type: {j.type} • Created {new Date(j.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {j.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic font-medium py-3">No jobs found for this recruiter.</p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                onClick={() => setSelectedRecruiter(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
