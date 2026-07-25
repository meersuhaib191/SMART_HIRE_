"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { Button } from "@smarthire/ui";
import { MapPin, Briefcase, Calendar, Settings, ArrowLeft, Loader2 } from "lucide-react";
import { logger } from "@smarthire/logger";

interface JobDetails {
  id: string;
  title: string;
  category?: string;
  location?: string;
  type: "full-time" | "part-time" | "contract" | "internship";
  status: "draft" | "published" | "closed";
  created_at: string;
}

export default function JobDetailsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<JobDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showMenu, setShowMenu] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  const fetchJobDetails = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        logger.warn(`[JobDetailsLayout] /api/jobs/${jobId} returned HTTP ${res.status}`);
        return;
      }
      const { data } = await res.json();
      if (data) setJob(data);
    } catch (err) {
      logger.error("Failed to load job details layout", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  const handleAction = async (action: "publish" | "archive" | "delete") => {
    if (!job) return;
    setActionLoading(true);
    setShowMenu(false);

    try {
      let endpoint = `/api/jobs/${job.id}`;
      let method = "PATCH";

      if (action === "publish") {
        endpoint += "/publish";
        method = "PATCH";
      } else if (action === "archive") {
        endpoint += "/archive";
        method = "PATCH";
      } else if (action === "delete") {
        method = "DELETE";
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Failed to ${action} job posting`);
      }

      if (action === "delete") {
        router.push("/recruiter/jobs");
      } else {
        await fetchJobDetails();
      }
    } catch (err: unknown) {
      logger.error(`Error performing action ${action} on job details`, err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-lg font-bold text-zinc-300">Job posting not found</h3>
        <Link href="/recruiter/jobs" className="text-blue-500 hover:underline">
          Return to Jobs List
        </Link>
      </div>
    );
  }

  const isOverviewActive = pathname === `/recruiter/jobs/${jobId}`;
  const isApplicationsActive = pathname === `/recruiter/jobs/${jobId}/applications`;
  const isClosed = job.status === "closed";
  const isDraft = job.status === "draft";

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6">
      {/* Back button */}
      <div className="text-left">
        <Link
          href="/recruiter/jobs"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Jobs
        </Link>
      </div>

      {/* Header Container */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/20 pb-6 text-left">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-150">
              {job.title}
            </h1>
            <JobStatusBadge status={job.status} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-550 dark:text-zinc-450 font-medium">
            <span className="text-blue-500 uppercase tracking-wide font-semibold">
              {job.category || "Uncategorized"}
            </span>
            <div className="h-3 w-px bg-zinc-800" />
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{job.location || "Remote"}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div className="flex items-center gap-1">
              <Briefcase className="h-4 w-4 shrink-0" />
              <span className="capitalize">{job.type.replace("-", " ")}</span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Created {new Date(job.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Actions Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/recruiter/jobs/${job.id}/edit`}>
            <Button
              variant="outline"
              disabled={actionLoading}
              className="border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-350 h-10 px-4 text-xs"
            >
              Edit Job
            </Button>
          </Link>

          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowMenu(!showMenu)}
              disabled={actionLoading}
              className="border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-350 h-10 px-3 flex items-center justify-center"
            >
              <Settings className="h-4.5 w-4.5" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 mt-1.5 w-36 rounded-lg border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-[#09090c] shadow-lg py-1 z-30 text-xs text-left animate-in fade-in duration-100">
                {isDraft && (
                  <button
                    onClick={() => handleAction("publish")}
                    className="w-full px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    Publish posting
                  </button>
                )}
                {!isClosed && (
                  <button
                    onClick={() => handleAction("archive")}
                    className="w-full px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    Archive posting
                  </button>
                )}
                <button
                  onClick={() => handleAction("delete")}
                  className="w-full px-4 py-2 hover:bg-red-500/10 text-red-500 font-medium"
                >
                  Delete posting
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex border-b border-zinc-150 dark:border-zinc-850 overflow-x-auto max-w-full">
        <Link
          href={`/recruiter/jobs/${jobId}`}
          className={`px-6 py-3 text-xs md:text-sm font-semibold border-b-2 shrink-0 transition-colors ${
            isOverviewActive
              ? "border-blue-500 text-blue-500 font-bold"
              : "border-transparent text-zinc-550 dark:text-zinc-400 hover:text-zinc-850 dark:hover:text-zinc-250"
          }`}
        >
          Overview Details
        </Link>
        <Link
          href={`/recruiter/jobs/${jobId}/applications`}
          className={`px-6 py-3 text-xs md:text-sm font-semibold border-b-2 shrink-0 transition-colors ${
            isApplicationsActive
              ? "border-blue-500 text-blue-500 font-bold"
              : "border-transparent text-zinc-550 dark:text-zinc-400 hover:text-zinc-850 dark:hover:text-zinc-250"
          }`}
        >
          Applications Pipeline
        </Link>
      </div>

      {/* Main Content Area */}
      <div>{children}</div>
    </div>
  );
}
