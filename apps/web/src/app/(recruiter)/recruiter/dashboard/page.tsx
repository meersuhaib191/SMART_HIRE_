"use client";

import * as React from "react";
import {
  MetricCard,
  ChartCard,
  QuickActionGrid,
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

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

export default function RecruiterDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [orgName, setOrgName] = React.useState("SmartHire Workspace");

  // KPI states
  const [openJobsCount, setOpenJobsCount] = React.useState(0);
  const [draftJobsCount, setDraftJobsCount] = React.useState(0);
  const [applicationsCount, setApplicationsCount] = React.useState(0);
  const [candidatesCount, setCandidatesCount] = React.useState(0);
  const [offersCount, setOffersCount] = React.useState(0);
  const [interviewsToday, setInterviewsToday] = React.useState<DashboardInterview[]>([]);
  const [, setRecentApps] = React.useState<DashboardApp[]>([]);

  // Charts states
  const [funnelData, setFunnelData] = React.useState<{ label: string; value: number }[]>([]);
  const [trendData, setTrendData] = React.useState<{ label: string; value: number }[]>([]);

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let userCompanyId: string | null = null;
        let userRecruiterId: string | null = null;

        if (user) {
          // 1. First check local storage backup for customized company name
          if (typeof window !== "undefined") {
            const userProfileKey = `smarthire_active_recruiter_profile_${user.id}`;
            const localData = localStorage.getItem(userProfileKey);
            if (localData) {
              try {
                const parsed = JSON.parse(localData);
                if (parsed?.companyName) {
                  setOrgName(parsed.companyName);
                }
              } catch (e) {
                logger.error("Failed to parse stored profile JSON", e);
              }
            }
          }

          // 2. Query Database recruiter & company details
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
              const { data: company } = await supabase
                .schema("organization")
                .from("companies")
                .select("name")
                .eq("id", recruiter.company_id)
                .maybeSingle();
              if (company?.name) {
                setOrgName(company.name);
              }
            }
          } else if (user.user_metadata?.company_name) {
            setOrgName(user.user_metadata.company_name);
          } else if (user.user_metadata?.first_name) {
            setOrgName(`${user.user_metadata.first_name}'s Workspace`);
          }
        }

        // 3. Fetch Jobs posted by THIS recruiter / company ONLY
        if (!userCompanyId && !userRecruiterId) {
          setOpenJobsCount(0);
          setDraftJobsCount(0);
          setApplicationsCount(0);
          setCandidatesCount(0);
          setOffersCount(0);
          setRecentApps([]);
          setFunnelData([
            { label: "Applied", value: 0 },
            { label: "Screening", value: 0 },
            { label: "Interview", value: 0 },
            { label: "Offer", value: 0 },
          ]);
          setTrendData([]);
          setLoading(false);
          return;
        }

        let jobsQuery = supabase.schema("job").from("jobs").select("id, title, status, company_id, recruiter_id").is("deleted_at", null);
        if (userCompanyId) {
          jobsQuery = jobsQuery.eq("company_id", userCompanyId);
        } else if (userRecruiterId) {
          jobsQuery = jobsQuery.eq("recruiter_id", userRecruiterId);
        }

        const { data: jobs } = await jobsQuery;
        const recruiterJobs = jobs || [];

        if (recruiterJobs.length > 0) {
          setOpenJobsCount(recruiterJobs.filter((j) => j.status === "published").length);
          setDraftJobsCount(recruiterJobs.filter((j) => j.status === "draft").length);

          const recruiterJobIds = recruiterJobs.map((j) => j.id);

          // 4. Fetch Applications ONLY for THIS recruiter's jobs
          const { data: apps } = await supabase
            .schema("application")
            .from("applications")
            .select("id, candidate_id, job_id, created_at, status")
            .in("job_id", recruiterJobIds)
            .is("deleted_at", null);

          const recruiterApps = apps || [];

          if (recruiterApps.length > 0) {
            setApplicationsCount(recruiterApps.length);
            const uniqueCandidates = new Set(recruiterApps.map((a) => a.candidate_id));
            setCandidatesCount(uniqueCandidates.size);

            const activeOffers = recruiterApps.filter((a) =>
              ["offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())
            ).length;
            setOffersCount(activeOffers);

            // Compute Funnel & Trend ONLY for this recruiter's job applications
            const appliedCount = recruiterApps.length;
            const screeningCount = recruiterApps.filter((a) =>
              ["screening", "mcq", "coding", "interview", "zoom_interview", "offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())
            ).length;
            const interviewCount = recruiterApps.filter((a) =>
              ["interview", "zoom_interview", "offered", "offer", "accepted", "hired"].includes(a.status?.toLowerCase())
            ).length;
            const offerCount = activeOffers;

            setFunnelData([
              { label: "Applied", value: appliedCount },
              { label: "Screening", value: screeningCount },
              { label: "Interview", value: interviewCount },
              { label: "Offer", value: offerCount },
            ]);

            const last30Days = Array.from({ length: 30 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (29 - i));
              return d.toISOString().split("T")[0];
            });

            const formattedTrend = last30Days.map((dateStr) => {
              const count = recruiterApps.filter(
                (a) => a.created_at && a.created_at.startsWith(dateStr)
              ).length;
              const label = new Date(dateStr).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
              return { label, value: count };
            });
            setTrendData(formattedTrend);

            // Build recent applications table for this recruiter
            const latestApps = [...recruiterApps]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5);

            if (latestApps.length > 0) {
              const candIds = latestApps.map((a) => a.candidate_id);
              const jIds = latestApps.map((a) => a.job_id);

              const { data: profiles } = await supabase
                .schema("candidate")
                .from("candidates")
                .select("id, first_name, last_name")
                .in("id", candIds);
              const { data: jobListings } = await supabase
                .schema("job")
                .from("jobs")
                .select("id, title")
                .in("id", jIds);

              const mappedApps: DashboardApp[] = latestApps.map((a) => {
                const prof = (profiles || []).find((p) => p.id === a.candidate_id);
                const jObj = (jobListings || []).find((j) => j.id === a.job_id);

                return {
                  id: a.id,
                  candidate_id: a.candidate_id,
                  candidate_name: prof ? `${prof.first_name} ${prof.last_name}` : "Candidate",
                  job_title: jObj ? jObj.title : "Technical Position",
                  created_at: a.created_at,
                  status: a.status,
                };
              });
              setRecentApps(mappedApps);
            }
          } else {
            // Recruiter has jobs but zero applications
            setApplicationsCount(0);
            setCandidatesCount(0);
            setOffersCount(0);
            setFunnelData([
              { label: "Applied", value: 0 },
              { label: "Screening", value: 0 },
              { label: "Interview", value: 0 },
              { label: "Offer", value: 0 },
            ]);
            setTrendData([]);
          }
        } else {
          // Recruiter has 0 jobs
          setOpenJobsCount(0);
          setDraftJobsCount(0);
          setApplicationsCount(0);
          setCandidatesCount(0);
          setOffersCount(0);
          setFunnelData([
            { label: "Applied", value: 0 },
            { label: "Screening", value: 0 },
            { label: "Interview", value: 0 },
            { label: "Offer", value: 0 },
          ]);
          setTrendData([]);
        }

        // 5. Fetch Today's Scheduled Interviews for THIS recruiter's applications only
        const { data: meetings } = await supabase
          .schema("interview")
          .from("interviews")
          .select("id, interview_type, status, scheduled_at, duration_minutes, meeting_link, application_id")
          .order("scheduled_at", { ascending: true });

        if (meetings && meetings.length > 0 && recruiterJobs.length > 0) {
          const recruiterJobIds = recruiterJobs.map((j) => j.id);
          const appIds = meetings.map((m) => m.application_id);
          const { data: appRecords } = await supabase
            .schema("application")
            .from("applications")
            .select("id, candidate_id, job_id")
            .in("id", appIds)
            .in("job_id", recruiterJobIds);

          if (appRecords && appRecords.length > 0) {
            const validAppIds = new Set(appRecords.map((a) => a.id));
            const filteredMeetings = meetings.filter((m) => validAppIds.has(m.application_id));

            const candIds = appRecords.map((a) => a.candidate_id);
            const jIds = appRecords.map((a) => a.job_id);

            const { data: profiles } = await supabase
              .schema("candidate")
              .from("candidates")
              .select("id, first_name, last_name")
              .in("id", candIds);
            const { data: jobListings } = await supabase
              .schema("job")
              .from("jobs")
              .select("id, title")
              .in("id", jIds);

            const mappedInterviews: DashboardInterview[] = filteredMeetings.map((meet) => {
              const matchingApp = appRecords.find((a) => a.id === meet.application_id);
              const prof = matchingApp ? (profiles || []).find((p) => p.id === matchingApp.candidate_id) : null;
              const jObj = matchingApp ? (jobListings || []).find((j) => j.id === matchingApp.job_id) : null;

              return {
                id: meet.id,
                candidate_name: prof ? `${prof.first_name} ${prof.last_name}` : "Applicant",
                job_title: jObj ? jObj.title : "Opening",
                scheduled_at: meet.scheduled_at,
                interview_type: meet.interview_type,
                meeting_link: meet.meeting_link,
              };
            });

            setInterviewsToday(mappedInterviews.slice(0, 5));
          }
        }
      } catch (err) {
        logger.error("Failed to load recruiter dashboard aggregate statistics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const kpis = [
    { label: "Open Positions", value: openJobsCount, subtext: "Currently recruiting", icon: Briefcase, color: "text-[#0071E3] bg-[#EAF3FF] border-[#C5DCFF]", trend: openJobsCount > 0 ? 8 : undefined },
    { label: "Draft Positions", value: draftJobsCount, subtext: "Awaiting reviews", icon: Layers, color: "text-[#6E6E73] bg-[#F5F5F7] border-[#D2D2D7]" },
    { label: "Active Applicants", value: applicationsCount, subtext: "Total funnel volume", icon: Users, color: "text-[#0071E3] bg-[#EAF3FF] border-[#C5DCFF]", trend: applicationsCount > 0 ? 12 : undefined },
    { label: "Candidates Directory", value: candidatesCount, subtext: "Unique talent profiles", icon: FileSpreadsheet, color: "text-[#0071E3] bg-[#EAF3FF] border-[#C5DCFF]", trend: candidatesCount > 0 ? 5 : undefined },
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
    </div>
  );
}
