"use client";

import * as React from "react";
import {

  Building2,
  Users,
  Briefcase,
  FileSpreadsheet,
  Cpu,
  Activity,
  Loader2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase clients for schemas
const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });
const appClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "application" } });
const orgClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "organization" } });
const jobClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "job" } });

export default function AdminDashboardPage() {
  const [loading, setLoading] = React.useState(true);

  // Stats Counters
  const [companiesCount, setCompaniesCount] = React.useState(0);
  const [recruitersCount, setRecruitersCount] = React.useState(0);
  const [candidatesCount, setCandidatesCount] = React.useState(0);
  const [jobsCount, setJobsCount] = React.useState(0);
  const [applicationsCount, setApplicationsCount] = React.useState(0);

  React.useEffect(() => {
    const fetchAdminStats = async () => {
      setLoading(true);
      try {
        // Fetch companies count
        const { data: companies } = await orgClient.from("companies").select("id");
        if (companies) setCompaniesCount(companies.length);

        // Fetch recruiters count
        const { data: recruiters } = await orgClient.from("recruiters").select("id");
        if (recruiters) setRecruitersCount(recruiters.length);

        // Fetch candidates count
        const { data: candidates } = await candClient.from("candidates").select("id").is("deleted_at", null);
        if (candidates) setCandidatesCount(candidates.length);

        // Fetch jobs count
        const { data: jobs } = await jobClient.from("jobs").select("id").is("deleted_at", null);
        if (jobs) setJobsCount(jobs.length);

        // Fetch applications count
        const { data: apps } = await appClient.from("applications").select("id").is("deleted_at", null);
        if (apps) setApplicationsCount(apps.length);
      } catch (err) {
        logger.error("Failed to load admin dashboard kpis", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminStats();
  }, []);

  const stats = [
    { label: "Total Companies", value: companiesCount, subtext: "Active clients", icon: Building2, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Active Recruiters", value: recruitersCount, subtext: "Team administrators", icon: Users, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    { label: "Candidates Directory", value: candidatesCount, subtext: "Seekers base", icon: ShieldCheck, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Job Postings", value: jobsCount, subtext: "Active listings", icon: Briefcase, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
    { label: "Applications", value: applicationsCount, subtext: "Total volume", icon: FileSpreadsheet, color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
    { label: "AI Tokens Usage", value: "12,420", subtext: "Last 24 hours", icon: Cpu, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-200">
      {/* Welcome Header */}
      <div>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
          Platform Operations Console
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-150 mt-1">
          Admin Dashboard
        </h1>
        <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1">
          Monitor company counts, active subscription volumes, feature allocations, and AI credits.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;

          return (
            <div
              key={idx}
              className="rounded-xl border border-zinc-200/50 dark:border-zinc-850 bg-white dark:bg-[#09090c]/40 p-4 flex flex-col justify-between h-28 text-left shadow-sm"
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block truncate max-w-[100px]">
                  {stat.label}
                </span>
                <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <span className="text-xl font-extrabold text-zinc-900 block tracking-tight">
                  {stat.value}
                </span>
                {stat.subtext && (
                  <span className="text-[9px] text-zinc-500 font-medium block truncate mt-0.5">
                    {stat.subtext}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Operations logs and activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-200 pb-2">
            <Activity className="h-4.5 w-4.5 text-zinc-450" /> System Events Audit Log
          </h3>
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-start p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="space-y-0.5">
                <p className="font-bold text-zinc-800">Company Suspended: Acme Corp</p>
                <p className="text-[10px] text-zinc-550">Action triggered by platform supervisor admin@smarthire.co</p>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">10m ago</span>
            </div>
            <div className="flex justify-between items-start p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="space-y-0.5">
                <p className="font-bold text-zinc-800">Feature Flag Changed: nextjs-caching</p>
                <p className="text-[10px] text-zinc-550">Flag set to true globally</p>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">1h ago</span>
            </div>
            <div className="flex justify-between items-start p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="space-y-0.5">
                <p className="font-bold text-zinc-800">Database Migrations Applied successfully</p>
                <p className="text-[10px] text-zinc-550">Version 20260712082850_interview_service</p>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">3h ago</span>
            </div>
          </div>
        </div>

        {/* AI usage details */}
        <div className="lg:col-span-4 rounded-xl border border-zinc-200 bg-white p-5 space-y-4 text-left self-start">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-blue-500" /> Platform Insights
          </h3>
          <p className="text-xs text-zinc-650 leading-relaxed">
            Platform performance checks show 99.98% database runtime health. Microservices event buses are streaming queue messages with latencies below 12 milliseconds.
          </p>
        </div>
      </div>
    </div>
  );
}
