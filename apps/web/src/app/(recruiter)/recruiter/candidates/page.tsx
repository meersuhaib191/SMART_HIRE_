"use client";

import * as React from "react";
import { CandidateTable } from "@/components/candidates/CandidateTable";
import { CandidateCard, type CandidateItem } from "@/components/candidates/CandidateCard";
import { EmptyState } from "@/components/jobs";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Grid,
  List,
  Users,
  Briefcase,
  FileCheck,
  X,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Award,
  GraduationCap,
  FileText,
  Loader2,
  Sparkles,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { SkeletonTable } from "@/components/shared/Skeleton";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface CandidateDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  summary?: string;
  tags?: string[];
  created_at: string;
  avatar_url?: string;
  // Application details
  application?: {
    id: string;
    job_id: string;
    job_title?: string;
    status: string;
    screening_score?: number;
    mcq_score?: number;
    coding_score?: number;
    interview_avg_score?: number;
    interview_recommendation?: string;
    created_at: string;
  } | null;
  // Related lists
  education?: Array<{
    id: string;
    institution: string;
    degree: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
  }>;
  experience?: Array<{
    id: string;
    company_name: string;
    job_title: string;
    description?: string;
    start_date?: string;
    end_date?: string;
  }>;
  resume?: {
    file_name: string;
    file_url?: string;
    created_at?: string;
  } | null;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = React.useState<CandidateItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [viewMode, setViewMode] = React.useState<"table" | "grid">("table");

  // Filters State
  const [search, setSearch] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [tag, setTag] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);

  // Application Maps
  const [stagesMap, setStagesMap] = React.useState<Record<string, string>>({});
  const [jobsMap, setJobsMap] = React.useState<Record<string, string>>({});

  // Slide-over Profile Drawer State
  const [selectedCandidate, setSelectedCandidate] = React.useState<CandidateItem | null>(null);
  const [drawerDetail, setDrawerDetail] = React.useState<CandidateDetail | null>(null);
  const [loadingDrawer, setLoadingDrawer] = React.useState(false);

  const passRate = React.useMemo(() => {
    const total = Object.keys(stagesMap).length;
    if (total === 0) return "0.0";
    const passed = Object.values(stagesMap).filter((status) =>
      ["offered", "offer", "accepted", "hired", "zoom_interview"].includes(status.toLowerCase())
    ).length;
    return ((passed / total) * 100).toFixed(1);
  }, [stagesMap]);

  const fetchCandidates = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userCompanyId: string | null = null;
      let userRecruiterId: string | null = null;

      if (user) {
        const { data: recruiter } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("id, company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (recruiter) {
          userRecruiterId = recruiter.id;
          if (recruiter.company_id) {
            userCompanyId = recruiter.company_id;
          }
        }
      }

      if (!userCompanyId && !userRecruiterId) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      let jobsQuery = supabase
        .schema("job")
        .from("jobs")
        .select("id")
        .is("deleted_at", null);

      if (userCompanyId) {
        jobsQuery = jobsQuery.eq("company_id", userCompanyId);
      } else if (userRecruiterId) {
        jobsQuery = jobsQuery.eq("recruiter_id", userRecruiterId);
      }

      const { data: userJobs } = await jobsQuery;
      const jobIds = (userJobs || []).map((j) => j.id);

      if (jobIds.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      const { data: jobApps } = await supabase
        .schema("application")
        .from("applications")
        .select("candidate_id")
        .in("job_id", jobIds)
        .is("deleted_at", null);

      const candidateIds = [...new Set((jobApps || []).map((a) => a.candidate_id))];

      if (candidateIds.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .schema("candidate")
        .from("candidates")
        .select("*")
        .in("id", candidateIds)
        .is("deleted_at", null);

      if (location) {
        query = query.ilike("location", `%${location}%`);
      }

      const { data: candList, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      let filtered: CandidateItem[] = candList || [];

      if (search) {
        const key = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.first_name?.toLowerCase().includes(key) ||
            c.last_name?.toLowerCase().includes(key) ||
            c.email?.toLowerCase().includes(key) ||
            c.headline?.toLowerCase().includes(key)
        );
      }

      if (tag) {
        const tagKey = tag.toLowerCase();
        filtered = filtered.filter((c) =>
          (c.tags || []).some((t: string) => t.toLowerCase().includes(tagKey))
        );
      }

      setCandidates(filtered);

      // Fetch related active applications & resolve job titles correctly from job.jobs schema
      if (filtered.length > 0) {
        const candidateIds = filtered.map((c) => c.id);
        const { data: apps } = await supabase
          .schema("application")
          .from("applications")
          .select("candidate_id, status, job_id")
          .in("candidate_id", candidateIds)
          .is("deleted_at", null);

        const newStages: Record<string, string> = {};
        const newJobs: Record<string, string> = {};

        const jobIds = [...new Set((apps || []).map((a) => a.job_id).filter(Boolean))];
        let jobsList: { id: string; title: string }[] = [];
        if (jobIds.length > 0) {
          // FIXED: query job.jobs schema instead of application.jobs
          const { data: jobs } = await supabase
            .schema("job")
            .from("jobs")
            .select("id, title")
            .in("id", jobIds);
          jobsList = jobs || [];
        }

        (apps || []).forEach((app) => {
          newStages[app.candidate_id] = app.status;
          const matchingJob = jobsList.find((j) => j.id === app.job_id);
          if (matchingJob) {
            newJobs[app.candidate_id] = matchingJob.title;
          }
        });

        setStagesMap(newStages);
        setJobsMap(newJobs);
      }
    } catch (err) {
      logger.error("Failed to load candidates list", err);
    } finally {
      setLoading(false);
    }
  }, [location, search, tag]);

  React.useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Open Candidate Drawer & Fetch Full Details
  const handleOpenDrawer = async (candidate: CandidateItem) => {
    setSelectedCandidate(candidate);
    setLoadingDrawer(true);
    try {
      // 1. Fetch Candidate Base Record
      const { data: profile } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("*")
        .eq("id", candidate.id)
        .maybeSingle();

      // 2. Fetch Latest Active Application + Job Title
      const { data: appData } = await supabase
        .schema("application")
        .from("applications")
        .select("id, job_id, status, screening_score, mcq_score, coding_score, interview_avg_score, interview_recommendation, created_at")
        .eq("candidate_id", candidate.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let jobTitle = "No Active Position";
      if (appData?.job_id) {
        const { data: job } = await supabase
          .schema("job")
          .from("jobs")
          .select("title")
          .eq("id", appData.job_id)
          .maybeSingle();
        if (job) jobTitle = job.title;
      }

      // 3. Fetch Education
      const { data: edu } = await supabase
        .schema("candidate")
        .from("education")
        .select("id, institution, degree, field_of_study, start_date, end_date")
        .eq("candidate_id", candidate.id)
        .order("start_date", { ascending: false });

      // 4. Fetch Experience
      const { data: exp } = await supabase
        .schema("candidate")
        .from("experience")
        .select("id, company_name, job_title, description, start_date, end_date")
        .eq("candidate_id", candidate.id)
        .order("start_date", { ascending: false });

      // 5. Fetch Resume
      const { data: resume } = await supabase
        .schema("candidate")
        .from("resumes")
        .select("file_name, file_url, created_at")
        .eq("candidate_id", candidate.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setDrawerDetail({
        id: candidate.id,
        first_name: profile?.first_name || candidate.first_name,
        last_name: profile?.last_name || candidate.last_name,
        email: profile?.email || candidate.email,
        phone: profile?.phone || candidate.phone,
        headline: profile?.headline || candidate.headline,
        location: profile?.location || candidate.location,
        summary: profile?.summary || "",
        tags: profile?.tags || candidate.tags || [],
        created_at: profile?.created_at || candidate.created_at,
        avatar_url: profile?.avatar_url,
        application: appData ? {
          ...appData,
          job_title: jobTitle,
        } : null,
        education: edu || [],
        experience: exp || [],
        resume: resume || null,
      });
    } catch (err) {
      logger.error("Failed to load candidate full profile drawer data", err);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setLocation("");
    setTag("");
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left sh-animate-in">
      {/* Page Header */}
      <div className="flex justify-between items-center text-left border-b border-zinc-200 pb-5">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
            Talent Pool
          </span>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight mt-0.5">
            Candidates Directory
          </h1>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Search applicant profiles, review evaluation scorecards, and inspect full candidate backgrounds.
          </p>
        </div>
      </div>

      {/* Analytics Counter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center gap-4 text-left shadow-sm hover:shadow-md transition-all">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 font-bold">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Total Applicants
            </span>
            <span className="text-2xl font-extrabold text-zinc-900 mt-0.5 block tabular-nums">
              {candidates.length}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center gap-4 text-left shadow-sm hover:shadow-md transition-all">
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 font-bold">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Active Pipeline Map
            </span>
            <span className="text-2xl font-extrabold text-zinc-900 mt-0.5 block tabular-nums">
              {Object.keys(stagesMap).length}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex items-center gap-4 text-left shadow-sm hover:shadow-md transition-all">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 font-bold">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Pass Rate Average
            </span>
            <span className="text-2xl font-extrabold text-zinc-900 mt-0.5 block tabular-nums">
              {passRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar Controls */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search candidates by name, email, headline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2 text-xs font-medium text-zinc-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showFilters || location || tag
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {(location || tag) && (
                <span className="ml-1 h-2 w-2 rounded-full bg-blue-600" />
              )}
            </button>

            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "table" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-700"
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === "grid" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-700"
                }`}
                title="Grid View"
              >
                <Grid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showFilters && (
          <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Filter by Location</label>
              <input
                type="text"
                placeholder="e.g. Remote, New York..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Filter by Skill Tag</label>
              <input
                type="text"
                placeholder="e.g. React, Python..."
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleClearFilters}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Table or Grid */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="No candidates match your query"
          description="Try broadening your search keywords or clearing your filters to view all talent pool applicants."
          action={
            <Button onClick={handleClearFilters} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl px-4 py-2 cursor-pointer">
              Clear Filters
            </Button>
          }
        />
      ) : viewMode === "table" ? (
        <CandidateTable
          candidates={candidates}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          stagesMap={stagesMap}
          jobsMap={jobsMap}
          onViewCandidate={handleOpenDrawer}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((cand) => (
            <CandidateCard
              key={cand.id}
              candidate={cand}
              jobApplied={jobsMap[cand.id]}
              stage={stagesMap[cand.id]}
              onViewCandidate={handleOpenDrawer}
            />
          ))}
        </div>
      )}

      {/* Interactive Candidate Profile Slide-over Drawer */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-250 text-left">
            {/* Drawer Header */}
            <div className="p-6 border-b border-zinc-100 bg-zinc-50/80 sticky top-0 z-10 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center shadow-sm shrink-0">
                  {selectedCandidate.first_name?.charAt(0)}{selectedCandidate.last_name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900 leading-snug">
                    {selectedCandidate.first_name} {selectedCandidate.last_name}
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium">{selectedCandidate.headline || "Applicant"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/recruiter/candidates/${selectedCandidate.id}`}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all"
                  title="Open Full Candidate Workspace"
                >
                  Full Profile <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => { setSelectedCandidate(null); setDrawerDetail(null); }}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {loadingDrawer ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                  <p className="text-xs font-bold text-zinc-500">Loading complete candidate record...</p>
                </div>
              ) : (
                <>
                  {/* Contact Info Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600">
                    <div className="flex items-center gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate font-semibold text-zinc-800">{drawerDetail?.email}</span>
                    </div>
                    {drawerDetail?.phone && (
                      <div className="flex items-center gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="font-semibold text-zinc-800">{drawerDetail.phone}</span>
                      </div>
                    )}
                    {drawerDetail?.location && (
                      <div className="flex items-center gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        <MapPin className="h-4 w-4 text-purple-500 shrink-0" />
                        <span className="font-semibold text-zinc-800">{drawerDetail.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Applied Position & Pipeline Card */}
                  {drawerDetail?.application ? (
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-bold text-zinc-900">{drawerDetail.application.job_title}</span>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {drawerDetail.application.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Evaluation Scores Breakdown */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-blue-100/80 text-center">
                        <div className="bg-white p-2 rounded-xl border border-blue-100">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">ATS Match</span>
                          <span className="text-sm font-extrabold text-blue-600">
                            {drawerDetail.application.screening_score != null ? `${drawerDetail.application.screening_score * 10}%` : "N/A"}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-blue-100">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">MCQ Test</span>
                          <span className="text-sm font-extrabold text-purple-600">
                            {drawerDetail.application.mcq_score != null ? `${drawerDetail.application.mcq_score}%` : "N/A"}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-blue-100">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">IDE Coding</span>
                          <span className="text-sm font-extrabold text-emerald-600">
                            {drawerDetail.application.coding_score != null ? `${drawerDetail.application.coding_score}%` : "N/A"}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-blue-100">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">AI Interview</span>
                          <span className="text-sm font-extrabold text-indigo-600">
                            {drawerDetail.application.interview_avg_score != null ? `${drawerDetail.application.interview_avg_score}` : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400 italic">
                      No active application records on file
                    </div>
                  )}

                  {/* Summary */}
                  {drawerDetail?.summary && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Candidate Bio & Overview
                      </h4>
                      <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50 p-3.5 rounded-xl border border-zinc-100">
                        {drawerDetail.summary}
                      </p>
                    </div>
                  )}

                  {/* Skills / Tags */}
                  {drawerDetail?.tags && drawerDetail.tags.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Verified Skills & Competencies
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {drawerDetail.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work Experience */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-blue-600" /> Work Experience
                    </h4>
                    {drawerDetail?.experience && drawerDetail.experience.length > 0 ? (
                      <div className="space-y-2.5">
                        {drawerDetail.experience.map((exp) => (
                          <div key={exp.id} className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-zinc-900">{exp.job_title}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">
                                {exp.start_date ? new Date(exp.start_date).toLocaleDateString([], { month: "short", year: "numeric" }) : ""} - {exp.end_date ? new Date(exp.end_date).toLocaleDateString([], { month: "short", year: "numeric" }) : "Present"}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-blue-600">{exp.company_name}</p>
                            {exp.description && (
                              <p className="text-xs text-zinc-600 leading-relaxed pt-1">{exp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        No work experience logs recorded
                      </p>
                    )}
                  </div>

                  {/* Education */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-blue-600" /> Education History
                    </h4>
                    {drawerDetail?.education && drawerDetail.education.length > 0 ? (
                      <div className="space-y-2.5">
                        {drawerDetail.education.map((edu) => (
                          <div key={edu.id} className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-zinc-900">{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ""}</span>
                              <span className="text-[10px] text-zinc-400 font-medium">
                                {edu.start_date ? new Date(edu.start_date).getFullYear() : ""} - {edu.end_date ? new Date(edu.end_date).getFullYear() : "Present"}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-zinc-600">{edu.institution}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        No education records listed
                      </p>
                    )}
                  </div>

                  {/* Resume Document */}
                  {drawerDetail?.resume && (
                    <div className="space-y-2 pt-2 border-t border-zinc-100">
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-600" /> Attached Resume
                      </h4>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-zinc-50">
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-xs font-bold text-zinc-900">{drawerDetail.resume.file_name}</p>
                            <p className="text-[10px] text-zinc-400">Uploaded {drawerDetail.resume.created_at ? new Date(drawerDetail.resume.created_at).toLocaleDateString() : "recently"}</p>
                          </div>
                        </div>
                        {drawerDetail.resume.file_url && (
                          <a
                            href={drawerDetail.resume.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                          >
                            Download <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
