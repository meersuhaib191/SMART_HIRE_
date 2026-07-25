"use client";

import * as React from "react";
import {
  Building2,
  Search,
  Loader2,
  Briefcase,
  Users,
  FileSpreadsheet,
  Globe,
  MapPin,
  Eye,
  X,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

interface CompanyItem {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  company_size?: string | null;
  location?: string | null;
  created_at: string;
  recruitersCount: number;
  jobsCount: number;
  appsCount: number;
}

export default function AdminCompaniesPage() {
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<CompanyItem[]>([]);
  const [search, setSearch] = React.useState("");

  // Modal State
  const [selectedCompany, setSelectedCompany] = React.useState<CompanyItem | null>(null);
  const [companyRecruiters, setCompanyRecruiters] = React.useState<any[]>([]);
  const [companyJobs, setCompanyJobs] = React.useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  const fetchCompanies = React.useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: compData, error: compErr } = await supabase
        .schema("organization")
        .from("companies")
        .select("id, name, domain, industry, company_size, location, created_at")
        .order("created_at", { ascending: false });

      if (compErr) throw compErr;

      const { data: recData } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("company_id");

      const { data: jobsData } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, company_id");

      const { data: appsData } = await supabase
        .schema("application")
        .from("applications")
        .select("id, job_id");

      const recCounts: Record<string, number> = {};
      (recData || []).forEach((r) => { if (r.company_id) recCounts[r.company_id] = (recCounts[r.company_id] || 0) + 1; });

      const jobCounts: Record<string, number> = {};
      const jobCompanyMap: Record<string, string> = {};
      (jobsData || []).forEach((j) => {
        if (j.company_id) {
          jobCounts[j.company_id] = (jobCounts[j.company_id] || 0) + 1;
          jobCompanyMap[j.id] = j.company_id;
        }
      });

      const appCounts: Record<string, number> = {};
      (appsData || []).forEach((a) => {
        const cId = jobCompanyMap[a.job_id];
        if (cId) appCounts[cId] = (appCounts[cId] || 0) + 1;
      });

      const list: CompanyItem[] = (compData || []).map((c) => ({
        ...c,
        recruitersCount: recCounts[c.id] || 0,
        jobsCount: jobCounts[c.id] || 0,
        appsCount: appCounts[c.id] || 0,
      }));

      setCompanies(list);
    } catch (err) {
      logger.error("Failed to load companies for admin", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleOpenCompanyModal = async (comp: CompanyItem) => {
    setSelectedCompany(comp);
    setLoadingDetails(true);
    const supabase = createClient();

    try {
      const { data: recs } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("id, first_name, last_name, email, title")
        .eq("company_id", comp.id);

      const { data: jobs } = await supabase
        .schema("job")
        .from("jobs")
        .select("id, title, status, category, created_at")
        .eq("company_id", comp.id);

      setCompanyRecruiters(recs || []);
      setCompanyJobs(jobs || []);
    } catch (err) {
      logger.error("Failed to load company details", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.industry || "").toLowerCase().includes(q) || (c.domain || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
            Platform Multi-Tenant Organizations
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 mt-0.5">
            Companies Overview
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Inspect corporate clients, active team recruiter accounts, and hiring pipelines.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company by name, industry..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Companies Table */}
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
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Domain / Web</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Team Size</th>
                  <th className="py-3 px-4">Recruiters</th>
                  <th className="py-3 px-4">Active Jobs</th>
                  <th className="py-3 px-4">Total Applications</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {filteredCompanies.map((comp) => (
                  <tr key={comp.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-extrabold text-zinc-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      {comp.name}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 font-mono text-[11px]">{comp.domain || "—"}</td>
                    <td className="py-3.5 px-4 text-zinc-600">{comp.industry || "Software & Tech"}</td>
                    <td className="py-3.5 px-4 text-zinc-600">{comp.company_size || "1-10"}</td>
                    <td className="py-3.5 px-4 font-bold text-violet-700">{comp.recruitersCount} Members</td>
                    <td className="py-3.5 px-4 font-bold text-blue-700">{comp.jobsCount} Listings</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700">{comp.appsCount} Applicants</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenCompanyModal(comp)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detailed Report
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400 text-xs italic font-medium">
                      No companies found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Company Detailed Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 space-y-6 text-left max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900">{selectedCompany.name}</h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    {selectedCompany.domain || "No domain"} • {selectedCompany.industry || "Technology"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-zinc-400 hover:text-zinc-700 h-8 w-8 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Details Grid */}
            {loadingDetails ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team Recruiters */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-violet-600" /> Team Recruiters ({companyRecruiters.length})
                  </h4>
                  {companyRecruiters.length > 0 ? (
                    <div className="space-y-2">
                      {companyRecruiters.map((r) => (
                        <div key={r.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-xs text-zinc-900">{r.first_name || "Recruiter"} {r.last_name || ""}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{r.email}</p>
                          </div>
                          <span className="text-[9px] font-bold text-zinc-600 bg-zinc-200 px-2 py-0.5 rounded-md">
                            {r.title || "Recruiter"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No recruiters assigned.</p>
                  )}
                </div>

                {/* Published Jobs */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 text-blue-600" /> Published Openings ({companyJobs.length})
                  </h4>
                  {companyJobs.length > 0 ? (
                    <div className="space-y-2">
                      {companyJobs.map((j) => (
                        <div key={j.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-xs text-zinc-900">{j.title}</p>
                            <p className="text-[10px] text-zinc-500">{j.category || "Engineering"}</p>
                          </div>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {j.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No job openings created.</p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-200 flex justify-end">
              <button
                onClick={() => setSelectedCompany(null)}
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
