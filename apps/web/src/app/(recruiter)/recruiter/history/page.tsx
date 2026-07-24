"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Calendar, Briefcase, Trophy, CheckCircle2, Search, Filter, History, Sparkles, MapPin, ArrowRight, Users } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface HiringJobRecord {
  id: string;
  title: string;
  category?: string;
  location?: string;
  status: string;
  created_at: string;
  company_name?: string;
  total_candidates: number;
  hired_candidates: {
    id: string;
    candidate_id: string;
    candidate_name: string;
    candidate_email?: string;
    candidate_headline?: string;
    status: string;
    score?: number | null;
    mcq_score?: number | null;
    coding_score?: number | null;
    interview_avg_score?: number | null;
    created_at: string;
  }[];
}

export default function RecruiterHiringHistoryPage() {
  const [jobRecords, setJobRecords] = React.useState<HiringJobRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  React.useEffect(() => {
    const fetchHiringHistory = async () => {
      try {
        // Fetch all job postings from job.jobs
        const { data: jobs, error: jobErr } = await supabase
          .schema("job")
          .from("jobs")
          .select("id, title, category, location, status, created_at, company_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (jobErr) throw jobErr;

        if (jobs && jobs.length > 0) {
          const companyIds = [...new Set(jobs.map((j) => j.company_id).filter(Boolean))];
          let companies: { id: string; name: string }[] = [];
          if (companyIds.length > 0) {
            const { data: compList } = await supabase
              .schema("organization")
              .from("companies")
              .select("id, name")
              .in("id", companyIds);
            companies = compList || [];
          }

          const jobIds = jobs.map((j) => j.id);
          const { data: apps, error: appErr } = await supabase
            .schema("application")
            .from("applications")
            .select("id, job_id, candidate_id, status, score, mcq_score, coding_score, interview_avg_score, created_at")
            .in("job_id", jobIds)
            .is("deleted_at", null);

          if (appErr) throw appErr;

          const candIds = [...new Set((apps || []).map((a) => a.candidate_id).filter(Boolean))];
          const candidateMap = new Map<string, { name: string; email?: string; headline?: string }>();
          if (candIds.length > 0) {
            const { data: candList } = await supabase
              .schema("candidate")
              .from("candidates")
              .select("id, first_name, last_name, email, headline")
              .in("id", candIds);

            (candList || []).forEach((c) => {
              const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Candidate";
              candidateMap.set(c.id, {
                name: fullName,
                email: c.email || undefined,
                headline: c.headline || undefined,
              });
            });
          }

          const mapped: HiringJobRecord[] = jobs.map((j) => {
            const comp = companies.find((c) => c.id === j.company_id);
            const jobApps = (apps || []).filter((a) => a.job_id === j.id);
            const hired = jobApps
              .filter((a) => ["joined", "offer_accepted", "offer_sent", "offered"].includes(a.status))
              .map((a) => {
                const candInfo = candidateMap.get(a.candidate_id);
                return {
                  ...a,
                  candidate_name: candInfo?.name || `Candidate #${a.candidate_id.slice(0, 6)}`,
                  candidate_email: candInfo?.email,
                  candidate_headline: candInfo?.headline,
                };
              });

            return {
              id: j.id,
              title: j.title,
              category: j.category || "Engineering",
              location: j.location || "Remote",
              status: j.status,
              created_at: j.created_at,
              company_name: comp?.name || "Waadi Media",
              total_candidates: jobApps.length,
              hired_candidates: hired,
            };
          });

          setJobRecords(mapped);
        }
      } catch (err) {
        logger.error("Failed to load recruiter hiring history", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHiringHistory();
  }, []);

  const filteredRecords = React.useMemo(() => {
    return jobRecords.filter((rec) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        rec.title.toLowerCase().includes(query) ||
        (rec.company_name && rec.company_name.toLowerCase().includes(query)) ||
        (rec.category && rec.category.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "closed" && rec.status === "closed") ||
        (statusFilter === "hired" && rec.hired_candidates.length > 0);

      return matchesSearch && matchesStatus;
    });
  }, [jobRecords, searchQuery, statusFilter]);

  const totalClosedJobs = jobRecords.filter((j) => j.status === "closed").length;
  const totalHiredCandidates = jobRecords.reduce((acc, j) => acc + j.hired_candidates.length, 0);
  const totalApplicationsEvaluated = jobRecords.reduce((acc, j) => acc + j.total_candidates, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500 font-medium">Loading recruiter hiring history archive...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 text-left animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
            Recruiter Organization Console
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Hiring History & Closed Pipeline Archive
        </h1>
        <p className="text-sm text-zinc-500 font-medium">
          Review historical position requisitions, closed hiring loops, candidate evaluation metrics, and dispatched offer letters.
        </p>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Candidates Evaluated", value: totalApplicationsEvaluated, icon: Users, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "Hired & Offered Candidates", value: totalHiredCandidates, icon: Sparkles, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
          { label: "Closed / Filled Positions", value: totalClosedJobs, icon: Trophy, color: "text-purple-600 bg-purple-50 border-purple-100" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 flex items-center gap-4 ${stat.color.split(" ").slice(1).join(" ")}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color.split(" ")[0]} ${stat.color.split(" ")[1]}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-zinc-900 tabular-nums">{stat.value}</p>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search job title, company, or division..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2 text-xs font-medium text-zinc-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0 mr-1" />
          {[
            { id: "all", label: "All Hiring Loops" },
            { id: "hired", label: "With Hired Candidates" },
            { id: "closed", label: "Closed / Filled Positions" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hiring History Cards List */}
      <div className="space-y-6">
        {filteredRecords.map((job) => {
          const isClosed = job.status === "closed";

          return (
            <div
              key={job.id}
              className={`rounded-2xl border bg-white p-6 space-y-4 text-left shadow-sm hover:shadow-md transition-all ${
                isClosed ? "border-purple-200 bg-gradient-to-r from-white via-zinc-50/30 to-purple-50/20" : "border-zinc-200"
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isClosed ? "bg-purple-100 text-purple-700" : "bg-blue-50 text-blue-600"
                  }`}>
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-zinc-900">{job.title}</h2>
                      <span className="text-xs font-bold text-zinc-500">· {job.company_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Posted {new Date(job.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="font-bold text-zinc-700">{job.total_candidates} Applicants Evaluated</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold capitalize border ${
                    isClosed
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {isClosed ? "Closed / Filled" : "Active Requisition"}
                  </span>

                  <Link href={`/recruiter/pipeline?jobId=${job.id}`}>
                    <button className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs h-8 px-3 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
                      View Pipeline <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Hired Candidates List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Hired Candidates & Dispatched Offers ({job.hired_candidates.length})
                  </span>
                </div>

                {job.hired_candidates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {job.hired_candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-extrabold text-zinc-900 text-sm">{cand.candidate_name}</span>
                            {cand.candidate_headline && (
                              <span className="text-[11px] text-zinc-500 font-medium">· {cand.candidate_headline}</span>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full capitalize shrink-0">
                            {cand.status.replace("_", " ")}
                          </span>
                        </div>

                        {cand.candidate_email && (
                          <p className="text-[11px] text-zinc-500 font-medium pl-6">
                            {cand.candidate_email}
                          </p>
                        )}

                        <p className="text-[10px] text-zinc-500 font-mono pl-6 pt-0.5">
                          ATS Score: {cand.score != null ? (cand.score <= 10 ? `${Number(cand.score).toFixed(1)}/10 (${Math.round(cand.score * 10)}%)` : `${Math.round(cand.score)}%`) : "N/A"} · MCQ: {cand.mcq_score != null ? `${Math.round(cand.mcq_score)}%` : "N/A"} · Coding: {cand.coding_score != null ? (cand.coding_score <= 10 ? `${Number(cand.coding_score).toFixed(0)}/10 (${Math.round(cand.coding_score * 10)}%)` : `${Math.round(cand.coding_score)}%`) : "N/A"} · Interview: {cand.interview_avg_score != null ? `${Number(cand.interview_avg_score).toFixed(1)}/10` : "N/A"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400 italic">
                    No offer letters dispatched for this position yet.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredRecords.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-500 italic text-sm">
            No hiring history records match your search filter.
          </div>
        )}
      </div>
    </div>
  );
}
