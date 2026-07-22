"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { CheckSquare, Sparkles, Loader2, ArrowUpRight } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const orgClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "organization" } });

interface JobDetails {
  id: string;
  title: string;
  description: string;
  category?: string;
  location?: string;
  type: string;
  status: string;
  salary_min?: number;
  salary_max?: number;
  experience_level: string;
  recruiter_id: string;
  department_id?: string;
  created_at: string;
}

export default function JobOverviewPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<JobDetails | null>(null);
  const [departmentName, setDepartmentName] = React.useState<string>("None");
  const [recruiterName, setRecruiterName] = React.useState<string>("Lead Recruiter");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadDetails = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Failed to load details");
        const { data } = await res.json();
        setJob(data);

        if (data.department_id) {
          const { data: dept } = await orgClient
            .from("departments")
            .select("name")
            .eq("id", data.department_id)
            .maybeSingle();
          if (dept) setDepartmentName(dept.name);
        }

        if (data.recruiter_id) {
          const { data: rec } = await orgClient
            .from("recruiters")
            .select("id, user_id")
            .eq("id", data.recruiter_id)
            .maybeSingle();
          if (rec) {
            setRecruiterName("Assigned Lead Recruiter");
          }
        }
      } catch (err) {
        logger.error("Failed to load overview data", err);
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[250px]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-in fade-in duration-200">
      {/* Left Column: Job Description and Specs */}
      <div className="lg:col-span-8 space-y-6">
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6 space-y-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">Description & Details</h3>
          <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
            {job.description}
          </p>
        </div>

        {/* Timeline milestones */}
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150 mb-4">Pipeline Milestones</h3>
          <div className="relative border-l border-zinc-850 pl-6 space-y-6 text-sm">
            <div className="relative">
              <span className="absolute -left-[30px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-8 ring-[#030303]">
                <CheckSquare className="h-2 w-2" />
              </span>
              <p className="font-semibold text-zinc-300">Job opening created</p>
              <p className="text-xs text-zinc-550 mt-0.5">
                On {new Date(job.created_at).toLocaleDateString()} by Hiring Team
              </p>
            </div>
            <div className="relative">
              <span className="absolute -left-[30px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white ring-8 ring-[#030303]">
                <Sparkles className="h-2 w-2" />
              </span>
              <p className="font-semibold text-zinc-300">Hiring funnel active</p>
              <p className="text-xs text-zinc-555 mt-0.5">Screener and assessment pipelines initialized</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Hiring Team & Specifications Metadata */}
      <div className="lg:col-span-4 space-y-6">
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6 space-y-4">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-150 border-b border-zinc-800 pb-2">
            Hiring Specifications
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-550">Department</span>
              <span className="font-semibold text-zinc-300">{departmentName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-555">Hiring Lead</span>
              <span className="font-semibold text-zinc-300">{recruiterName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-555">Experience Level</span>
              <span className="font-semibold text-zinc-300 capitalize">{job.experience_level}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-555">Salary Range</span>
              <span className="font-semibold text-zinc-300">
                {job.salary_min ? `$${job.salary_min.toLocaleString()} - $${job.salary_max?.toLocaleString()}` : "Undisclosed"}
              </span>
            </div>
          </div>
        </div>

        {/* Simple analytics overview card */}
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-150">Performance</h3>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-550 block uppercase">Views</span>
              <span className="text-lg font-bold text-zinc-200 mt-1 block">412</span>
            </div>
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
              <span className="text-[10px] text-zinc-555 block uppercase">Conversions</span>
              <span className="text-lg font-bold text-zinc-200 mt-1 block">8.4%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
