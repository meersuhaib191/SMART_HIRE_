"use client";

import * as React from "react";
import Link from "next/link";
import { JobTable, JobCard, JobFilters, JobAnalyticsCard, EmptyState, ConfirmDialog } from "@/components/jobs";
import { Button } from "@smarthire/ui";
import {

  Plus,
  Briefcase,
  Layers,
  Archive,
  BarChart,
  Grid,
  List,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { SkeletonTable } from "@/components/shared/Skeleton";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface JobItem {
  id: string;
  title: string;
  category?: string;
  location?: string;
  type: "full-time" | "part-time" | "contract" | "internship";
  status: "draft" | "published" | "closed";
  salary_min?: number;
  salary_max?: number;
  experience_level: string;
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = React.useState<JobItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [viewMode, setViewMode] = React.useState<"table" | "grid">("table");

  const [totalApps, setTotalApps] = React.useState(0);

  // Filters State
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [type, setType] = React.useState("");

  // Dialog State
  const [actionJob, setActionJob] = React.useState<JobItem | null>(null);
  const [actionType, setActionType] = React.useState<"publish" | "archive" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Bulk dialog state
  const [bulkActionType, setBulkActionType] = React.useState<"publish" | "archive" | "delete" | null>(null);

  // Fetch Jobs List scoped to recruiter's company
  const fetchJobs = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userCompanyId: string | null = null;

      if (user) {
        const { data: recruiter } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (recruiter?.company_id) {
          userCompanyId = recruiter.company_id;
        }
      }

      let query = supabase
        .schema("job")
        .from("jobs")
        .select("*")
        .is("deleted_at", null);

      if (userCompanyId) {
        query = query.eq("company_id", userCompanyId);
      }
      if (status) {
        query = query.eq("status", status);
      }
      if (location) {
        query = query.ilike("location", `%${location}%`);
      }
      if (type) {
        query = query.eq("type", type);
      }

      const { data } = await query.order("created_at", { ascending: false });

      // Apply client-side search text filtering
      let filtered = data || [];
      if (search) {
        const queryStr = search.toLowerCase();
        filtered = filtered.filter(
          (j: JobItem) =>
            j.title.toLowerCase().includes(queryStr) ||
            (j.category && j.category.toLowerCase().includes(queryStr))
        );
      }

      setJobs(filtered);

      // Fetch dynamic total applications count for recruiter's company jobs
      if (filtered.length > 0) {
        const jobIds = filtered.map((j: JobItem) => j.id);
        const { count } = await supabase
          .schema("application")
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("job_id", jobIds)
          .is("deleted_at", null);
        setTotalApps(count || 0);
      } else {
        setTotalApps(0);
      }
    } catch (err) {
      logger.error("Failed to load jobs", err);
    } finally {
      setLoading(false);
    }
  }, [status, location, type, search]);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setLocation("");
    setType("");
  };

  // Perform Job Actions
  const handleJobAction = async () => {
    if (!actionJob || !actionType) return;
    setActionLoading(true);

    try {
      let endpoint = `/api/jobs/${actionJob.id}`;
      let method = "PATCH";

      if (actionType === "publish") {
        endpoint += "/publish";
        method = "PATCH";
      } else if (actionType === "archive") {
        endpoint += "/archive";
        method = "PATCH";
      } else if (actionType === "delete") {
        method = "DELETE";
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Failed to ${actionType} job posting`);
      }

      // Optimistic state updates
      if (actionType === "delete") {
        setJobs(jobs.filter((j) => j.id !== actionJob.id));
      } else {
        const updatedStatus = actionType === "publish" ? "published" : "closed";
        setJobs(
          jobs.map((j) => (j.id === actionJob.id ? { ...j, status: updatedStatus as "published" | "closed" } : j))
        );
      }

      setActionJob(null);
      setActionType(null);
    } catch (err: unknown) {
      logger.error(`Failed to perform ${actionType} action on job`, err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Actions Handlers
  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkActionType) return;
    setActionLoading(true);

    try {
      // Trigger bulk actions sequentially
      for (const id of selectedIds) {
        let endpoint = `/api/jobs/${id}`;
        let method = "PATCH";

        if (bulkActionType === "publish") {
          endpoint += "/publish";
          method = "PATCH";
        } else if (bulkActionType === "archive") {
          endpoint += "/archive";
          method = "PATCH";
        } else if (bulkActionType === "delete") {
          method = "DELETE";
        }

        await fetch(endpoint, { method });
      }

      // Refresh list
      await fetchJobs();
      setSelectedIds([]);
      setBulkActionType(null);
    } catch (err) {
      logger.error("Bulk action failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Dashboard Stats Calculations
  const stats = React.useMemo(() => {
    const openCount = jobs.filter((j) => j.status === "published").length;
    const draftCount = jobs.filter((j) => j.status === "draft").length;
    const closedCount = jobs.filter((j) => j.status === "closed").length;

    return {
      open: openCount,
      draft: draftCount,
      closed: closedCount,
      total: jobs.length,
    };
  }, [jobs]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto sh-animate-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left border-b border-[#E8E8ED] pb-6">
        <div>
          <span className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider block">
            Job Management
          </span>
          <h1 className="text-[28px] font-bold text-[#1D1D1F] tracking-tight mt-1">
            Jobs Directory
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">
            Manage your hiring postings, track pipelines, and review scorecard analytics.
          </p>
        </div>

        <Link href="/recruiter/jobs/create">
          <Button variant="primary" className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-10 px-4 rounded-[12px] text-[13px] font-semibold transition-colors duration-150 shrink-0 shadow-sm">
            <Plus className="h-4 w-4" /> Create Job Posting
          </Button>
        </Link>
      </div>

      {/* Dashboard Analytics Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <JobAnalyticsCard title="Active Openings" value={stats.open} icon={<Briefcase className="h-4.5 w-4.5 text-[#0071E3]" />} />
        <JobAnalyticsCard title="Draft Postings" value={stats.draft} icon={<Layers className="h-4.5 w-4.5 text-[#6E6E73]" />} />
        <JobAnalyticsCard title="Closed / Archived" value={stats.closed} icon={<Archive className="h-4.5 w-4.5 text-[#FF3B30]" />} />
        <JobAnalyticsCard title="Total Applications" value={totalApps} icon={<BarChart className="h-4.5 w-4.5 text-[#FF9F0A]" />} description="Across all listed positions" />
      </div>

      {/* Domain Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {["All Domains", "Technology", "Finance", "Marketing", "Human Resources", "Design & Creative", "Legal", "Operations", "Healthcare"].map((domain) => {
          const catKey = domain === "All Domains" ? "" : domain.toLowerCase();
          const isSel = (search.toLowerCase() === catKey) || (domain === "All Domains" && !search);
          return (
            <button
              key={domain}
              onClick={() => setSearch(domain === "All Domains" ? "" : domain)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSel
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {domain}
            </button>
          );
        })}
      </div>

      {/* Status Lifecycle Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mr-2">Lifecycle Status:</span>
        {[
          { label: `All Jobs (${stats.total})`, val: "" },
          { label: `Drafts (${stats.draft})`, val: "draft" },
          { label: `Published (${stats.open})`, val: "published" },
          { label: `Closed (${stats.closed})`, val: "closed" },
        ].map((tab) => (
          <button
            key={tab.val}
            onClick={() => setStatus(tab.val)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              status === tab.val
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filters Drawer */}
      <div className="pt-1">
        <JobFilters
          searchValue={search}
          statusValue={status}
          locationValue={location}
          typeValue={type}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onLocationChange={setLocation}
          onTypeChange={setType}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Layout View Modes & Bulk Actions Panel */}
      <div className="flex items-center justify-between border-b border-[#E8E8ED] pb-4">
        {/* Bulk Actions Controls */}
        <div className="flex items-center gap-2 min-h-[38px]">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2.5 bg-[#EAF3FF] border border-[#C5DCFF] rounded-[12px] px-3.5 py-1.5 text-[12px] text-[#0071E3] animate-in fade-in zoom-in-95 duration-150">
              <span className="font-semibold">{selectedIds.length} selected</span>
              <div className="h-3.5 w-px bg-[#C5DCFF] mx-1" />
              <button
                onClick={() => setBulkActionType("publish")}
                className="hover:underline font-semibold text-[#0071E3]"
                disabled={loading}
              >
                Publish
              </button>
              <span className="text-[#AEAEB2]">â€¢</span>
              <button
                onClick={() => setBulkActionType("archive")}
                className="hover:underline font-semibold text-[#0071E3]"
                disabled={loading}
              >
                Archive
              </button>
              <span className="text-[#AEAEB2]">â€¢</span>
              <button
                onClick={() => setBulkActionType("delete")}
                className="hover:underline text-[#FF3B30] font-semibold"
                disabled={loading}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
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
        <SkeletonTable rows={5} cols={7} />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No Job Postings Found"
          description="Build and launch your first AI-assisted job description today."
          action={
            <Link href="/recruiter/jobs/create">
              <Button variant="primary" className="bg-[#0071E3] text-white hover:bg-[#006ACC] rounded-[12px] h-10 px-5 font-semibold transition-colors duration-150">
                Create Job Wizard
              </Button>
            </Link>
          }
        />
      ) : viewMode === "table" ? (
        <JobTable
          jobs={jobs}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          onActionClick={(job, action) => {
            setActionJob(job);
            setActionType(action);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onActionClick={(j, action) => {
                setActionJob(j);
                setActionType(action);
              }}
            />
          ))}
        </div>
      )}

      {/* Action Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!actionJob && !!actionType}
        onClose={() => {
          setActionJob(null);
          setActionType(null);
        }}
        onConfirm={handleJobAction}
        loading={actionLoading}
        title={
          actionType === "delete"
            ? "Delete Job Posting?"
            : actionType === "publish"
            ? "Publish Job Posting?"
            : "Archive Job Posting?"
        }
        description={
          actionType === "delete"
            ? "Are you sure? This soft deletes the job opening and closes current pipelines. This action can be rolled back by administrators."
            : actionType === "publish"
            ? "This will transition this posting to published, allowing candidate self-application pipelines to initiate."
            : "This will transition this posting to closed, halting all assessments and scheduling."
        }
        confirmText={
          actionType === "delete" ? "Delete Job" : actionType === "publish" ? "Publish Job" : "Archive Job"
        }
        destructive={actionType === "delete"}
      />

      {/* Bulk Action Confirmation Dialog */}
      <ConfirmDialog
        isOpen={selectedIds.length > 0 && !!bulkActionType}
        onClose={() => setBulkActionType(null)}
        onConfirm={handleBulkAction}
        loading={actionLoading}
        title={`Bulk ${bulkActionType} jobs?`}
        description={`This performs the ${bulkActionType} command on all ${selectedIds.length} selected job openings.`}
        confirmText="Confirm Bulk Action"
        destructive={bulkActionType === "delete"}
      />
    </div>
  );
}
