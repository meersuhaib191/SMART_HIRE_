"use client";

import * as React from "react";
import {
  Users,
  Search,
  Loader2,
  FileSpreadsheet,
  Building,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  X,
  Award,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface CandidateItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  headline?: string | null;
  location?: string | null;
  created_at: string;
  appCount: number;
}

interface ApplicationDetail {
  id: string;
  status: string;
  score?: number | null;
  screening_score?: number | null;
  mcq_score?: number | null;
  coding_score?: number | null;
  interview_avg_score?: number | null;
  created_at: string;
  job_title?: string;
  company_name?: string;
}

export default function AdminCandidatesPage() {
  const [loading, setLoading] = React.useState(true);
  const [candidates, setCandidates] = React.useState<CandidateItem[]>([]);
  const [search, setSearch] = React.useState("");

  // Detailed Modal State
  const [selectedCandidate, setSelectedCandidate] = React.useState<CandidateItem | null>(null);
  const [candidateApps, setCandidateApps] = React.useState<ApplicationDetail[]>([]);
  const [loadingApps, setLoadingApps] = React.useState(false);

  const fetchCandidates = React.useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: candData, error: candErr } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, first_name, last_name, email, phone, headline, location, created_at")
        .order("created_at", { ascending: false });

      if (candErr) throw candErr;

      const { data: appData } = await supabase
        .schema("application")
        .from("applications")
        .select("candidate_id");

      const appCounts: Record<string, number> = {};
      (appData || []).forEach((a) => {
        if (a.candidate_id) appCounts[a.candidate_id] = (appCounts[a.candidate_id] || 0) + 1;
      });

      const list: CandidateItem[] = (candData || []).map((c) => ({
        ...c,
        first_name: c.first_name || "Candidate",
        last_name: c.last_name || "",
        appCount: appCounts[c.id] || 0,
      }));

      setCandidates(list);
    } catch (err) {
      logger.error("Failed to load candidates for admin", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleOpenCandidateModal = async (cand: CandidateItem) => {
    setSelectedCandidate(cand);
    setLoadingApps(true);
    setCandidateApps([]);
    const supabase = createClient();

    try {
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, status, job_id, created_at")
        .eq("candidate_id", cand.id);

      const { data: jobs } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, company_id");

      const jobMap: Record<string, { title: string; company_id?: string }> = {};
      (jobs || []).forEach((j) => { jobMap[j.id] = { title: j.title, company_id: j.company_id }; });

      const { data: comps } = await supabase
        .schema("organization")
        .from("companies")
        .select("id, name");

      const compMap: Record<string, string> = {};
      (comps || []).forEach((c) => { compMap[c.id] = c.name; });

      const appList: ApplicationDetail[] = (apps || []).map((a) => {
        const j = jobMap[a.job_id];
        return {
          id: a.id,
          status: a.status,
          created_at: a.created_at,
          job_title: j?.title || "Position",
          company_name: j?.company_id ? compMap[j.company_id] || "Organization" : "Independent",
        };
      });

      setCandidateApps(appList);
    } catch (err) {
      logger.error("Failed to load candidate applications", err);
    } finally {
      setLoadingApps(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    return fullName.includes(q) || c.email.toLowerCase().includes(q) || (c.headline || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
            Platform Management & Analytics
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-0.5">
            Candidates Directory
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Inspect platform seekers base, submitted applications history, and detailed evaluation scorecards.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates by name, email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Candidates Table */}
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
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Headline / Title</th>
                  <th className="py-3 px-4">Applications</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredCandidates.map((cand) => (
                  <tr key={cand.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {cand.first_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{cand.first_name} {cand.last_name}</p>
                          <p className="text-[10px] text-zinc-400 font-normal">{cand.location || "Location specified"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-700 font-mono text-[11px]">{cand.email}</td>
                    <td className="py-3.5 px-4 text-zinc-600">{cand.phone || "—"}</td>
                    <td className="py-3.5 px-4 text-zinc-600 truncate max-w-[180px]">{cand.headline || "Job Seeker"}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[10px]">
                        <FileSpreadsheet className="h-3 w-3" /> {cand.appCount} Submitted
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                      {new Date(cand.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenCandidateModal(cand)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detailed Report
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredCandidates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400 text-xs italic font-medium">
                      No candidates found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Candidate Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 space-y-6 text-left max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center">
                  {selectedCandidate.first_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900">
                    {selectedCandidate.first_name} {selectedCandidate.last_name}
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    {selectedCandidate.email} • {selectedCandidate.phone || "No phone listed"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="text-zinc-400 hover:text-zinc-700 h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Candidate Applications */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="h-4 w-4 text-blue-600" /> Recruitment Applications & Performance Scores
              </h4>

              {loadingApps ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : candidateApps.length > 0 ? (
                <div className="space-y-3">
                  {candidateApps.map((app) => (
                    <div key={app.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-extrabold text-sm text-zinc-900">{app.job_title}</p>
                          <p className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-0.5">
                            <Building className="h-3.5 w-3.5" /> {app.company_name}
                          </p>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full bg-zinc-900 text-white">
                          Stage: {app.status}
                        </span>
                      </div>

                      {/* Scores Breakdown */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-200/80 text-center font-mono text-[10px]">
                        <div className="p-2 rounded-lg bg-white border border-zinc-200">
                          <span className="text-zinc-400 block text-[9px] font-sans uppercase">ATS Match</span>
                          <span className="font-extrabold text-zinc-900">{app.screening_score != null ? `${app.screening_score}%` : "—"}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-zinc-200">
                          <span className="text-zinc-400 block text-[9px] font-sans uppercase">MCQ Score</span>
                          <span className="font-extrabold text-[#0071E3]">{app.mcq_score != null ? `${app.mcq_score}%` : "—"}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-zinc-200">
                          <span className="text-zinc-400 block text-[9px] font-sans uppercase">Coding IDE</span>
                          <span className="font-extrabold text-emerald-600">{app.coding_score != null ? `${app.coding_score}%` : "—"}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-zinc-200">
                          <span className="text-zinc-400 block text-[9px] font-sans uppercase">AI Interview</span>
                          <span className="font-extrabold text-violet-600">{app.interview_avg_score != null ? `${app.interview_avg_score}%` : "—"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic font-medium py-4">No application submissions found for this candidate.</p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                onClick={() => setSelectedCandidate(null)}
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
