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
  Briefcase,
  Play,
  Clock,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";
import { AtsCalculatorCard } from "@/components/dashboard/AtsCalculatorCard";
import { resolveCandidateProfileIds } from "@/utils/candidate-helper";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

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
  job_title?: string;
}

export default function CandidateDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [candidateName, setCandidateName] = React.useState("Candidate User");

  // Stats Counters
  const [profilePercent, setProfilePercent] = React.useState(60);
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
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { setLoading(false); return; }

        const candIds = await resolveCandidateProfileIds(supabase, authUser);

        if (candIds.length > 0) {
          const { data: cand } = await supabase
            .schema("candidate")
            .from("candidates")
            .select("id, first_name, last_name, summary")
            .in("id", candIds)
            .limit(1)
            .maybeSingle();

          if (cand) {
            setCandidateName(`${cand.first_name || "Candidate"} ${cand.last_name || ""}`.trim());
          } else if (authUser.email) {
            setCandidateName(authUser.email.split("@")[0]);
          }

          const { data: edu } = await supabase.schema("candidate").from("education").select("id").in("candidate_id", candIds);
          const { data: exp } = await supabase.schema("candidate").from("experience").select("id").in("candidate_id", candIds);

          const eduCount = edu?.length || 0;
          const expCount = exp?.length || 0;
          const calculatedPercent = Math.min(100, 40 + eduCount * 20 + expCount * 20);
          setProfilePercent(calculatedPercent);

          const { data: apps } = await supabase
            .schema("application")
            .from("applications")
            .select("id, created_at, status, job_id")
            .in("candidate_id", candIds)
            .is("deleted_at", null);

          if (apps) {
            setActiveAppsCount(apps.length);

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

          const { data: attempts } = await supabase
            .schema("assessment")
            .from("attempts")
            .select("id")
            .in("candidate_id", candIds);
          if (attempts) setExamsCount(attempts.length);

          if (apps && apps.length > 0) {
            const appIds = apps.map((a) => a.id);

            const { data: interviews } = await supabase
              .schema("interview")
              .from("interviews")
              .select("*")
              .in("application_id", appIds)
              .order("start_time", { ascending: true });

            if (interviews && interviews.length > 0) {
              setInterviewsCount(interviews.length);
              const intAppIds = interviews.map((m) => m.application_id);
              const { data: intApps } = await supabase.schema("application").from("applications").select("id, job_id").in("id", intAppIds);

              let jobsList: { id: string; title: string }[] = [];
              if (intApps && intApps.length > 0) {
                const jIds = intApps.map((a) => a.job_id);
                const { data: jobs } = await supabase.schema("job").from("jobs").select("id, title").in("id", jIds);
                jobsList = jobs || [];
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const mapped: RecentInterview[] = interviews.map((meet: any) => {
                const app = (intApps || []).find((a) => a.id === meet.application_id);
                const job = app ? jobsList.find((j) => j.id === app.job_id) : null;
                const meetingToken = meet.meeting_token || `smh_meet_${meet.id}`;
                const nativeLink = (meet.meeting_link && !meet.meeting_link.includes("google.com"))
                  ? meet.meeting_link
                  : `/interview/lobby/${meetingToken}`;

                const cleanTitle = (meet.meeting_title || meet.type || meet.interview_type || "Recruiter Final Interview")
                  .replace(/Google Meet Interview/gi, "Recruiter Final Interview")
                  .replace(/Google Meet/gi, "SmartHire Native Video");

                return {
                  id: meet.id,
                  interview_type: cleanTitle,
                  scheduled_at: meet.start_time || meet.scheduled_at || new Date().toISOString(),
                  duration_minutes: meet.duration_minutes || 60,
                  meeting_link: nativeLink,
                  job_title: job ? job.title : "Technical Position",
                };
              });
              setRecentInterviews(mapped.slice(0, 5));
            } else {
              setRecentInterviews([]);
            }
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
    { label: "Profile Specs", value: `${profilePercent}%`, icon: UserCheck, color: "text-blue-600 bg-blue-50 border-blue-100" },
    { label: "Active Applications", value: activeAppsCount, icon: FileSpreadsheet, color: "text-purple-600 bg-purple-50 border-purple-100" },
    { label: "Passed Assessments", value: examsCount, icon: ClipboardCheck, color: "text-amber-600 bg-amber-50 border-amber-100" },
    { label: "Scheduled Interviews", value: interviewsCount, icon: Calendar, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500 font-medium">Loading candidate dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 text-left animate-in fade-in duration-200">
      {/* Welcome Header */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
          Candidate Hub
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Welcome back, {candidateName}!
        </h1>
        <p className="text-sm text-zinc-500 font-medium">
          Track stage progression milestones, scheduled assessment exam entries, and live interview rooms.
        </p>
      </div>

      {/* Stats KPI Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;

          return (
            <div
              key={idx}
              className={`rounded-2xl border p-5 flex items-center gap-4 bg-white shadow-sm hover:shadow-md transition-all duration-200 ${stat.color.split(" ").slice(1).join(" ")}`}
            >
              <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${stat.color.split(" ")[0]} ${stat.color.split(" ")[1]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-zinc-900 tracking-tight tabular-nums">
                  {stat.value}
                </p>
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main dashboard columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column tables */}
        <div className="lg:col-span-8 space-y-6">
          {/* ATS Resume & JD Calculator Tool */}
          <AtsCalculatorCard />

          {/* Recent Applications */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                Recent Applications
              </h3>
              <Link href="/candidate/applications" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-zinc-50/70 rounded-xl border border-zinc-200/80 text-xs text-left hover:border-zinc-300 transition-colors"
                >
                  <div>
                    <h4 className="font-bold text-zinc-900 text-sm">{app.job_title}</h4>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Applied {new Date(app.created_at).toLocaleDateString([], { dateStyle: "medium" })}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold text-blue-700 capitalize">
                    {app.status}
                  </span>
                </div>
              ))}

              {recentApps.length === 0 && (
                <div className="text-center py-6 text-zinc-500 italic text-xs">
                  No applications sent yet. Search active roles to get started.
                </div>
              )}
            </div>
          </div>

          {/* Upcoming interview list */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                Upcoming Live Interviews
              </h3>
              <Link href="/candidate/interviews" className="text-xs font-bold text-purple-600 hover:text-purple-700">
                View All Lobbies →
              </Link>
            </div>
            <div className="space-y-4">
              {(() => {
                const grouped: Record<string, RecentInterview[]> = {};
                recentInterviews.forEach((int) => {
                  const title = int.job_title || "Technical Position";
                  if (!grouped[title]) grouped[title] = [];
                  grouped[title].push(int);
                });
                const titles = Object.keys(grouped);

                if (titles.length === 0) {
                  return (
                    <div className="text-center py-6 text-zinc-500 italic text-xs">
                      No interview sessions scheduled for today.
                    </div>
                  );
                }

                return titles.map((jobTitle) => (
                  <div key={jobTitle} className="space-y-2.5">
                    <div className="flex items-center justify-between bg-zinc-50 px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-800">
                      <span>{jobTitle}</span>
                      <span className="text-[10px] bg-white px-2.5 py-0.5 rounded-full border border-zinc-200 font-bold text-zinc-600">
                        {grouped[jobTitle].length} {grouped[jobTitle].length === 1 ? "Session" : "Sessions"}
                      </span>
                    </div>
                    <div className="space-y-2 pl-1">
                      {grouped[jobTitle].map((int) => (
                        <div
                          key={int.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-zinc-200 text-xs text-left hover:border-zinc-300 transition-colors shadow-sm"
                        >
                          <div className="space-y-1">
                            <h4 className="font-bold text-zinc-900 capitalize text-sm">{int.interview_type.replace("-", " ")} Session</h4>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
                              <Clock className="h-3.5 w-3.5 text-blue-600" />
                              <span>{new Date(int.scheduled_at).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}</span>
                              <span>•</span>
                              <span>{int.duration_minutes} mins</span>
                            </div>
                          </div>
                          <a
                            href={`/candidate/ai-interview/${int.id}/exam`}
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-sm shrink-0"
                          >
                            <Play className="h-3.5 w-3.5" /> Start Gemini Live Interview
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Right column sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 text-left shadow-sm">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Quick Shortcuts
            </h3>
            <div className="space-y-2.5">
              <Link href="/candidate/profile" className="block">
                <Button className="w-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-800 justify-between flex items-center h-10 px-4 text-xs font-bold rounded-xl cursor-pointer">
                  Update Profile Specs <ArrowUpRight className="h-4 w-4 text-zinc-500" />
                </Button>
              </Link>
              <Link href="/candidate/assessments" className="block">
                <Button className="w-full bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-800 justify-between flex items-center h-10 px-4 text-xs font-bold rounded-xl cursor-pointer">
                  View Assessments <ArrowUpRight className="h-4 w-4 text-zinc-500" />
                </Button>
              </Link>
              <Link href="/candidate/jobs" className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-between flex items-center h-10 px-4 text-xs font-bold rounded-xl shadow-sm cursor-pointer">
                  Browse Open Roles <ArrowUpRight className="h-4 w-4 text-white" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Recommended Jobs */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 text-left shadow-sm">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Suggested Job Openings
            </h3>
            <div className="space-y-3.5 text-xs">
              {recommendedJobs.map((job) => (
                <div key={job.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <Link href={`/candidate/jobs/${job.id}`} className="font-bold text-zinc-900 hover:text-blue-600 block truncate text-sm">
                    {job.title}
                  </Link>
                  <span className="text-[11px] text-zinc-500 font-medium capitalize">{job.department} • {job.location}</span>
                </div>
              ))}

              {recommendedJobs.length === 0 && (
                <div className="text-zinc-500 italic text-xs">No active positions found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

