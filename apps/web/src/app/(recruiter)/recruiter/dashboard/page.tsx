"use client";

import * as React from "react";
import {

  MetricCard,
  ChartCard,
  TaskList,
  QuickActionGrid,
  InterviewTable,
  ApplicationTable,
  InsightCard,
  DashboardInterview,
  DashboardApp,
} from "@/components/dashboard";
import {
  Briefcase,
  Users,
  FileSpreadsheet,
  Award,
  Video,
  Layers,
} from "lucide-react";
import { logger } from "@smarthire/logger";
import { SkeletonDashboard } from "@/components/shared/Skeleton";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

export default function RecruiterDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [orgName, setOrgName] = React.useState("Smart Hire Org");

  // KPI states
  const [openJobsCount, setOpenJobsCount] = React.useState(0);
  const [draftJobsCount, setDraftJobsCount] = React.useState(0);
  const [applicationsCount, setApplicationsCount] = React.useState(0);
  const [candidatesCount, setCandidatesCount] = React.useState(0);
  const [offersCount, setOffersCount] = React.useState(0);
  const [interviewsToday, setInterviewsToday] = React.useState<DashboardInterview[]>([]);
  const [recentApps, setRecentApps] = React.useState<DashboardApp[]>([]);

  // Tasks & Insights states
  const [tasksList, setTasksList] = React.useState<{ id: string; type: "review" | "feedback" | "expiry"; content: string; dueText: string }[]>([]);
  const [insightsList, setInsightsList] = React.useState<{ id: string; type: "top" | "warning" | "deadline"; content: string; subtext: string }[]>([]);

  // Charts states
  const [funnelData, setFunnelData] = React.useState<{ label: string; value: number }[]>([]);
  const [trendData, setTrendData] = React.useState<{ label: string; value: number }[]>([]);

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Organization Details
        const { data: companies } = await supabase.schema("organization").from("companies").select("name").limit(1).maybeSingle();
        if (companies) setOrgName(companies.name);

        // 2. Fetch Jobs count
        const { data: jobs } = await supabase.schema("job").from("jobs").select("title, status").is("deleted_at", null);
        if (jobs) {
          setOpenJobsCount(jobs.filter((j) => j.status === "published").length);
          setDraftJobsCount(jobs.filter((j) => j.status === "draft").length);
        }

        // 3. Fetch Candidates count
        const { data: candidates } = await supabase.schema("candidate").from("candidates").select("id").is("deleted_at", null);
        if (candidates) setCandidatesCount(candidates.length);

        // 4. Fetch Applications count
        const { data: apps } = await supabase.schema("application").from("applications").select("id, candidate_id, job_id, created_at, status").is("deleted_at", null);
        if (apps) {
          setApplicationsCount(apps.length);
          const activeOffers = apps.filter((a) => ["offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())).length;
          setOffersCount(activeOffers);

          // Build recent applications
          const latestApps = [...apps]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);

          // Resolve candidate names & job titles
          if (latestApps.length > 0) {
            const candIds = latestApps.map((a) => a.candidate_id);
            const jIds = latestApps.map((a) => a.job_id);

            const { data: profiles } = await supabase.schema("candidate").from("candidates").select("id, first_name, last_name").in("id", candIds);
            const { data: jobListings } = await supabase.schema("job").from("jobs").select("id, title").in("id", jIds);

            const mappedApps: DashboardApp[] = latestApps.map((a) => {
              const prof = (profiles || []).find((p) => p.id === a.candidate_id);
              const jObj = (jobListings || []).find((j) => j.id === a.job_id);

              return {
                id: a.id,
                candidate_id: a.candidate_id,
                candidate_name: prof ? `${prof.first_name} ${prof.last_name}` : "Jane Doe",
                job_title: jObj ? jObj.title : "Acme opening",
                created_at: a.created_at,
                status: a.status,
              };
            });
            setRecentApps(mappedApps);
          }
        }

        // 5. Fetch Today's Scheduled Interviews from interview schema
        const { data: meetings } = await supabase.schema("interview")
          .from("interviews")
          .select("id, interview_type, status, scheduled_at, duration_minutes, meeting_link, application_id")
          .order("scheduled_at", { ascending: true });

        if (meetings && meetings.length > 0) {
          // Resolve matching application candidate names & job titles
          const appIds = meetings.map((m) => m.application_id);
          const { data: appRecords } = await supabase.schema("application").from("applications").select("id, candidate_id, job_id").in("id", appIds);

          if (appRecords && appRecords.length > 0) {
            const candIds = appRecords.map((a) => a.candidate_id);
            const jIds = appRecords.map((a) => a.job_id);

            const { data: profiles } = await supabase.schema("candidate").from("candidates").select("id, first_name, last_name").in("id", candIds);
            const { data: jobListings } = await supabase.schema("job").from("jobs").select("id, title").in("id", jIds);

            const mappedInterviews: DashboardInterview[] = meetings.map((meet) => {
              const matchingApp = appRecords.find((a) => a.id === meet.application_id);
              const prof = matchingApp ? (profiles || []).find((p) => p.id === matchingApp.candidate_id) : null;
              const jObj = matchingApp ? (jobListings || []).find((j) => j.id === matchingApp.job_id) : null;

              return {
                id: meet.id,
                candidate_name: prof ? `${prof.first_name} ${prof.last_name}` : "Applicant Loop",
                job_title: jObj ? jObj.title : "Technical opening",
                scheduled_at: meet.scheduled_at,
                interview_type: meet.interview_type,
                meeting_link: meet.meeting_link,
              };
            });

            setInterviewsToday(mappedInterviews.slice(0, 5));
          }
        }

        // 6. Compute Real Funnel & Trend Data
        const appliedCount = apps ? apps.length : 0;
        const screeningCount = apps ? apps.filter((a) => ["screening", "interview", "interviewing", "offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())).length : 0;
        const interviewCount = apps ? apps.filter((a) => ["interview", "interviewing", "offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())).length : 0;
        const offerCount = apps ? apps.filter((a) => ["offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())).length : 0;

        setFunnelData([
          { label: "Applied", value: appliedCount },
          { label: "Screening", value: screeningCount },
          { label: "Interview", value: interviewCount },
          { label: "Offer", value: offerCount }
        ]);

        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return d.toISOString().split("T")[0];
        });

        const formattedTrend = last30Days.map(dateStr => {
          const count = apps ? apps.filter((a) => a.created_at && a.created_at.startsWith(dateStr)).length : 0;
          const label = new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return { label, value: count };
        });
        setTrendData(formattedTrend);

        // 7. Compute Dynamic Tasks
        const dynamicTasks = [];
        const newApps = apps ? apps.filter((a) => a.status === "applied").length : 0;
        if (newApps > 0) {
          dynamicTasks.push({
            id: "task-1",
            type: "review" as const,
            content: `Review ${newApps} new application profile${newApps > 1 ? "s" : ""}`,
            dueText: "Action Needed",
          });
        }

        const draftJobs = jobs ? jobs.filter((j) => j.status === "draft") : [];
        if (draftJobs.length > 0) {
          dynamicTasks.push({
            id: "task-2",
            type: "expiry" as const,
            content: `Complete draft position: "${draftJobs[0].title || "Untitled"}"`,
            dueText: "Draft",
          });
        }

        const interviewsCount = meetings ? meetings.length : 0;
        if (interviewsCount > 0) {
          dynamicTasks.push({
            id: "task-3",
            type: "feedback" as const,
            content: `Prepare for ${interviewsCount} scheduled interview${interviewsCount > 1 ? "s" : ""}`,
            dueText: "Scheduled",
          });
        }

        if (dynamicTasks.length === 0) {
          dynamicTasks.push({
            id: "task-f1",
            type: "review" as const,
            content: "No immediate reviews pending",
            dueText: "Up to date",
          });
        }
        setTasksList(dynamicTasks);

        // 8. Compute Dynamic Insights
        const dynamicInsights = [];
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const delayedApps = apps
          ? apps.filter((a) => a.status === "screening" && new Date(a.created_at) < tenDaysAgo).length
          : 0;

        if (delayedApps > 0) {
          dynamicInsights.push({
            id: "ins-1",
            type: "warning" as const,
            content: "Candidates waiting too long",
            subtext: `${delayedApps} applicant${delayedApps > 1 ? "s have" : " has"} spent > 10 days in Screening Stage.`,
          });
        }

        const totalActiveJobs = jobs ? jobs.filter((j) => j.status === "published").length : 0;
        if (totalActiveJobs > 0) {
          dynamicInsights.push({
            id: "ins-2",
            type: "top" as const,
            content: "Active Recruitment",
            subtext: `Active sourcing for ${totalActiveJobs} open position${totalActiveJobs > 1 ? "s" : ""}.`,
          });
        }

        const totalCands = candidates ? candidates.length : 0;
        if (totalCands > 0) {
          dynamicInsights.push({
            id: "ins-3",
            type: "deadline" as const,
            content: "Directory Growth",
            subtext: `${totalCands} unique candidate profiles are available in your directory.`,
          });
        }

        if (dynamicInsights.length === 0) {
          dynamicInsights.push({
            id: "ins-f1",
            type: "top" as const,
            content: "Welcome to Smart Hire",
            subtext: "Start posting jobs to view real-time recruitment insights.",
          });
        }
        setInsightsList(dynamicInsights);

      } catch (err) {
        logger.error("Failed to load recruiter dashboard aggregate statistics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const kpis = [
    { label: "Open Positions", value: openJobsCount, subtext: "Currently recruiting", icon: Briefcase, color: "text-[#0071E3] bg-[#EAF3FF] border-[#C5DCFF]", trend: 8 },
    { label: "Draft Positions", value: draftJobsCount, subtext: "Awaiting reviews", icon: Layers, color: "text-[#6E6E73] bg-[#F5F5F7] border-[#D2D2D7]" },
    { label: "Active Applicants", value: applicationsCount, subtext: "Total funnel volume", icon: Users, color: "text-[#0071E3] bg-[#EAF3FF] border-[#C5DCFF]", trend: 12 },
    { label: "Candidates Directory", value: candidatesCount, subtext: "Unique talent profiles", icon: FileSpreadsheet, color: "text-[#0071E3] bg-[#EAF3FF] border-[#C5DCFF]", trend: 5 },
    { label: "Scheduled Interviews", value: interviewsToday.length, subtext: "Happening today", icon: Video, color: "text-[#34C759] bg-[#EAFBEE] border-[#C5F0D2]" },
    { label: "Offers Issued", value: offersCount, subtext: "Sent this month", icon: Award, color: "text-[#FF9F0A] bg-[#FFF8EE] border-[#FFE8C2]" },
  ];

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto sh-animate-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left border-b border-[#E8E8ED] pb-6">
        <div>
          <span className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider block">
            Recruiter Workspace
          </span>
          <h1 className="text-[28px] font-bold text-[#1D1D1F] tracking-tight mt-1">
            Welcome to {orgName}
          </h1>
          <p className="text-[13px] text-[#6E6E73] mt-1 font-medium">
            Today is {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>
      </div>

      {/* Quick Action Toolbar */}
      <QuickActionGrid />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <MetricCard key={idx} {...kpi} />
        ))}
      </div>

      {/* Charts Funnel & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Active Recruiter Funnel" type="funnel" data={funnelData} />
        <ChartCard title="Applications Growth (Last 30 Days)" type="trend" data={trendData} />
      </div>

      {/* Tables & Tasks Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left tables */}
        <div className="lg:col-span-8 space-y-6">
          <InterviewTable interviews={interviewsToday} />
          <ApplicationTable applications={recentApps} />
        </div>

        {/* Right side checklists and AI insights */}
        <div className="lg:col-span-4 space-y-6">
          <TaskList tasks={tasksList} />
          <InsightCard insights={insightsList} />
        </div>
      </div>
    </div>
  );
}
