"use client";

import * as React from "react";
import { CandidateTable, CandidateCard } from "@/components/candidates";
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
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { SkeletonTable } from "@/components/shared/Skeleton";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  tags?: string[];
  created_at: string;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
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

  const passRate = React.useMemo(() => {
    const total = Object.keys(stagesMap).length;
    if (total === 0) return "0.0";
    const passed = Object.values(stagesMap).filter((status) =>
      ["offered", "offer", "accepted", "hired"].includes(status.toLowerCase())
    ).length;
    return ((passed / total) * 100).toFixed(1);
  }, [stagesMap]);

  const fetchCandidates = React.useCallback(async () => {
    setLoading(true);
    try {
      // Query candidates directly from candidates table (candidate schema)
      let query = supabase.schema("candidate").from("candidates").select("*").is("deleted_at", null);

      if (location) {
        query = query.ilike("location", `%${location}%`);
      }

      const { data: candList, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      let filtered: Candidate[] = candList || [];

      // Apply client side filters
      if (search) {
        const key = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.first_name.toLowerCase().includes(key) ||
            c.last_name.toLowerCase().includes(key) ||
            c.email.toLowerCase().includes(key)
        );
      }

      if (tag) {
        const tagKey = tag.toLowerCase();
        filtered = filtered.filter((c) =>
          (c.tags || []).some((t) => t.toLowerCase().includes(tagKey))
        );
      }

      setCandidates(filtered);

      // Fetch related active applications to populate job applied & current pipeline stages
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

        // To resolve job names, query the jobs table under public schema client
        const jobIds = (apps || []).map((a) => a.job_id);
        let jobsList: { id: string; title: string }[] = [];
        if (jobIds.length > 0) {
          const { data: jobs } = await supabase
            .schema("application")
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

  const handleClearFilters = () => {
    setSearch("");
    setLocation("");
    setTag("");
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto sh-animate-in">
      {/* Page Header */}
      <div className="flex justify-between items-center text-left border-b border-[#E8E8ED] pb-6">
        <div>
          <span className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider block">
            Talent Pool
          </span>
          <h1 className="text-[28px] font-bold text-[#1D1D1F] tracking-tight mt-1">
            Candidates Directory
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">
            Search applicant profiles, review scorecard stages, and manage pipeline logs.
          </p>
        </div>
      </div>

      {/* Analytics Counter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-5 flex items-center gap-4 text-left transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] hover:border-[#AEAEB2] cursor-default">
          <div className="h-10 w-10 rounded-[12px] bg-[#EAF3FF] text-[#0071E3] flex items-center justify-center shrink-0 border border-[#C5DCFF]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
              Total Applicants
            </span>
            <span className="text-2xl font-bold text-[#1D1D1F] mt-0.5 block tabular-nums">
              {candidates.length}
            </span>
          </div>
        </div>

        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-5 flex items-center gap-4 text-left transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] hover:border-[#AEAEB2] cursor-default">
          <div className="h-10 w-10 rounded-[12px] bg-[#EEEEFF] text-[#5E5CE6] flex items-center justify-center shrink-0 border border-[#D4D4FF]">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
              Active Pipeline Map
            </span>
            <span className="text-2xl font-bold text-[#1D1D1F] mt-0.5 block tabular-nums">
              {Object.keys(stagesMap).length}
            </span>
          </div>
        </div>

        <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-5 flex items-center gap-4 text-left transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] hover:border-[#AEAEB2] cursor-default">
          <div className="h-10 w-10 rounded-[12px] bg-[#EAFBEE] text-[#1A7F36] flex items-center justify-center shrink-0 border border-[#C5F0D2]">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
              Pass Rate Average
            </span>
            <span className="text-2xl font-bold text-[#1D1D1F] mt-0.5 block tabular-nums">
              {passRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full">
          {/* Search Bar */}
          <div className="relative flex-grow w-full">
            <input
              type="text"
              placeholder="Search candidates by name, email, headline..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[12px] border border-[#D2D2D7] bg-white pl-10 pr-4 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#6E6E73] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#6E6E73]" />
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F2F2F2] w-full justify-center h-11 px-5 rounded-[12px] text-[13px] font-medium transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#6E6E73]" /> Filters
            </Button>

            {(search || location || tag) && (
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="border-[#D2D2D7] text-[#6E6E73] hover:bg-[#F2F2F2] flex items-center justify-center shrink-0 h-11 w-11 p-0 rounded-[12px] transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Drawer */}
        {showFilters && (
          <div className="sh-scale-in rounded-[16px] border border-[#D2D2D7] bg-white p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left shadow-sm">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Candidate Location
              </label>
              <input
                type="text"
                placeholder="e.g. San Francisco, London"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Candidate Tags
              </label>
              <input
                type="text"
                placeholder="e.g. React, Python"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-[#F5F5F7] px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Layout View Modes Switcher */}
      <div className="flex items-center justify-between border-b border-[#E8E8ED] pb-4">
        <div className="text-[13px] text-[#6E6E73] font-medium">
          {candidates.length} candidates match filters
        </div>

        <div className="flex items-center gap-1 border border-[#D2D2D7] bg-white rounded-[12px] p-1 shadow-sm">
          <button
            onClick={() => setViewMode("table")}
            className={`h-8 w-8 rounded-[8px] flex items-center justify-center transition-all ${
              viewMode === "table"
                ? "bg-[#F5F5F7] text-[#1D1D1F]"
                : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F2F2F2]"
            }`}
            title="Table View"
          >
            <List className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`h-8 w-8 rounded-[8px] flex items-center justify-center transition-all ${
              viewMode === "grid"
                ? "bg-[#F5F5F7] text-[#1D1D1F]"
                : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F2F2F2]"
            }`}
            title="Grid View"
          >
            <Grid className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Main List Rendering */}
      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : candidates.length === 0 ? (
        <EmptyState
          title="No Candidates Found"
          description="Wait for candidates to apply or invite them to screening assessments."
        />
      ) : viewMode === "table" ? (
        <CandidateTable
          candidates={candidates}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          stagesMap={stagesMap}
          jobsMap={jobsMap}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((cand) => (
            <CandidateCard
              key={cand.id}
              candidate={cand}
              jobApplied={jobsMap[cand.id]}
              stage={stagesMap[cand.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
