"use client";

import * as React from "react";
import Link from "next/link";
import {
  UserCheck,
  FileSpreadsheet,
  ClipboardCheck,
  Calendar,
  Loader2,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface RecommendedJob {
  id: string;
  title: string;
  department?: string;
  location?: string;
}

interface RecentApp {
  id: string;
  job_title: string;
  created_at: string;
  status: string;
}

interface RecentInterview {
  id: string;
  interview_type: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string;
}

export default function CandidateDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [candidateName, setCandidateName] = React.useState("Candidate User");

  // Stats Counters
  const [profilePercent, setProfilePercent] = React.useState(60); // base completion
  const [activeAppsCount, setActiveAppsCount] = React.useState(0);
  const [examsCount, setExamsCount] = React.useState(0);
  const [interviewsCount, setInterviewsCount] = React.useState(0);

  // Detailed tables
  const [recentApps, setRecentApps] = React.useState<RecentApp[]>([]);
  const [recentInterviews, setRecentInterviews] = React.useState<RecentInterview[]>([]);
  const [recommendedJobs, setRecommendedJobs] = React.useState<RecommendedJob[]>([]);

  React.useEffect(() => {
    const fetchDashboardMetrics = async () => {
      setLoading(true);
      try {
        // 1. Fetch Candidate Profile metadata
        const { data: cand } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id, first_name, last_name, summary")
          .limit(1)
          .maybeSingle();

        if (cand) {
          setCandidateName(`${cand.first_name} ${cand.last_name}`);

          // Calculate profile percentage from education/experience records count
          const { data: edu } = await supabase.schema("candidate").from("education").select("id").eq("candidate_id", cand.id);
          const { data: exp } = await supabase.schema("candidate").from("experience").select("id").eq("candidate_id", cand.id);

          const eduCount = edu?.length || 0;
          const expCount = exp?.length || 0;
          const calculatedPercent = Math.min(100, 40 + eduCount * 20 + expCount * 20);
          setProfilePercent(calculatedPercent);

          // 2. Fetch Active Applications
          const { data: apps } = await supabase
            .schema("application")
            .from("applications")
            .select("id, created_at, status, job_id")
            .eq("candidate_id", cand.id)
            .is("deleted_at", null);

          if (apps) {
            setActiveAppsCount(apps.length);

            // Fetch Job details
            const jobIds = apps.map((a) => a.job_id);
            if (jobIds.length > 0) {
              const { data: jobs } = await supabase.schema("job").from("jobs").select("id, title").in("id", jobIds);

              const mappedApps = apps.map((a) => {
                const jObj = (jobs || []).find((j) => j.id === a.job_id);
                return {
                  id: a.id,
                  job_title: jObj ? jObj.title : "Opening Position",
                  created_at: a.created_at,
                  status: a.status,
                };
              });
              setRecentApps(mappedApps.slice(0, 3));
            }
          }

          // 3. Fetch Assigned Exam Attempts
          const { data: attempts } = await supabase
            .schema("assessment")
            .from("attempts")
            .select("id")
            .eq("candidate_id", cand.id);
          if (attempts) setExamsCount(attempts.length);

          // 4. Fetch Scheduled Interview loops
          const { data: interviews } = await supabase
            .schema("interview")
            .from("interviews")
            .select("id, interview_type, scheduled_at, duration_minutes, meeting_link")
            .order("scheduled_at", { ascending: true });

          if (interviews) {
            setInterviewsCount(interviews.length);
            setRecentInterviews(interviews.slice(0, 3));
          }
        }

        const { data: feedJobs } = await supabase
          .schema("job")
          .from("jobs")
          .select("id, title, category, location")
          .eq("status", "published")
          .limit(3);

        if (feedJobs) {
          const mappedFeed = feedJobs.map((j) => ({
            id: j.id,
            title: j.title,
            department: j.category || "General",
            location: j.location || "Remote",
          }));
          setRecommendedJobs(mappedFeed);
        } else {
          setRecommendedJobs([]);
        }
      } catch (err) {
        logger.error("Failed to load candidate portal dashboard statistics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardMetrics();
  }, []);

  const stats = [
    { label: "Profile Completion", value: `${profilePercent}%`, icon: UserCheck, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "My Applications", value: activeAppsCount, icon: FileSpreadsheet, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    { label: "Pending Assessments", value: examsCount, icon: ClipboardCheck, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
    { label: "Scheduled Interviews", value: interviewsCount, icon: Calendar, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
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
          Candidate Hub
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
          Hello, {candidateName}
        </h1>
        <p className="text-sm text-zinc-800 mt-1">
          Review your assessment invites, follow active pipelines, or upload your resume profile.
        </p>
      </div>

      {/* Stats KPI Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;

          return (
            <div
              key={idx}
              className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center gap-3.5 shadow-sm"
            >
              <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${stat.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">
                  {stat.label}
                </span>
                <span className="text-xl font-extrabold text-zinc-900 mt-0.5 block tracking-tight">
                  {stat.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main dashboard columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column tables */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Applications */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                My Recent Job Applications
              </h3>
              <Link href="/candidate/applications" className="text-xs text-blue-500 hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-left"
                >
                  <div>
                    <h4 className="font-bold text-zinc-900">{app.job_title}</h4>
                    <p className="text-[10px] text-zinc-700 mt-0.5">Applied {new Date(app.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-500 capitalize border border-blue-500/20">
                    {app.status}
                  </span>
                </div>
              ))}

              {recentApps.length === 0 && (
                <div className="text-center py-6 text-zinc-700 italic text-xs">
                  No applications sent yet. Search active roles to get started.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming interview list */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                Upcoming Live Interviews
              </h3>
              <Link href="/candidate/interviews" className="text-xs text-blue-500 hover:underline">
                View Lobbies
              </Link>
            </div>
            <div className="space-y-3">
              {recentInterviews.map((int) => (
                <div
                  key={int.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-xs text-left"
                >
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900 capitalize">{int.interview_type.replace("-", " ")} Session</h4>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-700">
                      <span>{new Date(int.scheduled_at).toLocaleString()}</span>
                      <span>â€¢</span>
                      <span>{int.duration_minutes} mins</span>
                    </div>
                  </div>
                  {int.meeting_link ? (
                    <a
                      href={int.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-[10px] font-bold shadow-sm"
                    >
                      Join Meeting
                    </a>
                  ) : (
                    <span className="text-[10px] text-zinc-700 italic">No link</span>
                  )}
                </div>
              ))}

              {recentInterviews.length === 0 && (
                <div className="text-center py-6 text-zinc-700 italic text-xs">
                  No interview sessions scheduled for today.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 text-left">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              Quick Shortcuts
            </h3>
            <div className="space-y-2">
              <Link href="/candidate/profile" className="block">
                <Button className="w-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-800 justify-between flex items-center h-10 px-4 text-xs font-semibold rounded-lg">
                  Update Profile Specs <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/candidate/resume" className="block">
                <Button className="w-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-800 justify-between flex items-center h-10 px-4 text-xs font-semibold rounded-lg">
                  Upload Resume PDF <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/candidate/jobs" className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white justify-between flex items-center h-10 px-4 text-xs font-bold rounded-lg shadow-sm">
                  Search Open Jobs <ArrowUpRight className="h-4 w-4 text-white" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Recommended Jobs */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4 text-left">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-blue-500" /> Suggested Job Openings
            </h3>
            <div className="space-y-3 text-xs">
              {recommendedJobs.map((job) => (
                <div key={job.id} className="border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                  <Link href={`/candidate/jobs/${job.id}`} className="font-bold text-zinc-800 hover:text-blue-500 block truncate">
                    {job.title}
                  </Link>
                  <span className="text-[10px] text-zinc-700 capitalize">{job.department} â€¢ {job.location}</span>
                </div>
              ))}

              {recommendedJobs.length === 0 && (
                <div className="text-zinc-700 italic text-xs">No active positions found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
