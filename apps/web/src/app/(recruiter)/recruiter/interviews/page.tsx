"use client";

import * as React from "react";
import { Loader2, Calendar, Video, Clock, Briefcase, Search, Filter } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface RecruiterInterviewItem {
  id: string;
  candidate_name: string;
  job_title: string;
  interview_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string;
  candidate_id?: string;
}

function CandidateAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-9 w-9 shrink-0 rounded-full bg-[#EAF3FF] text-[#0071E3] text-xs font-bold flex items-center justify-center border border-[#C5DCFF]">
      {initials}
    </div>
  );
}

function getSmartHireRoomUrl(int: RecruiterInterviewItem): string {
  if (int.meeting_link && !int.meeting_link.includes("google.com")) {
    return int.meeting_link;
  }
  const meetingToken = `smh_meet_${int.id.replace(/-/g, "")}`;
  return `/interview/lobby/${meetingToken}`;
}

export default function RecruiterInterviewsPage() {
  const [interviews, setInterviews] = React.useState<RecruiterInterviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    const fetchAllInterviews = async () => {
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
          setInterviews([]);
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
          setInterviews([]);
          setLoading(false);
          return;
        }

        // 1. Fetch applications in application schema for user's jobs
        const { data: candApps } = await supabase
          .schema("application")
          .from("applications")
          .select("id, candidate_id, job_id, status, interview_scheduled_at, created_at")
          .in("job_id", jobIds)
          .is("deleted_at", null);

        const appList = candApps || [];
        const appIds = appList.map((a) => a.id);

        // 2. Fetch meetings from interview schema
        let rawMeetings: any[] = [];
        try {
          let meetQuery = supabase
            .schema("interview")
            .from("interviews")
            .select("*");

          if (appIds.length > 0) {
            meetQuery = meetQuery.in("application_id", appIds);
          }

          const { data: meets } = await meetQuery;
          rawMeetings = meets || [];
        } catch (mErr) {
          logger.warn("Recruiter interviews fetch warning", mErr);
        }

        // 3. Fetch candidates profile list
        const candIds = [...new Set(appList.map((a) => a.candidate_id))];
        let candsList: { id: string; first_name: string; last_name: string }[] = [];
        if (candIds.length > 0) {
          const { data: cData } = await supabase
            .schema("candidate")
            .from("candidates")
            .select("id, first_name, last_name")
            .in("id", candIds);
          candsList = cData || [];
        }

        // 4. Fetch jobs list
        const targetJobIds = [...new Set(appList.map((a) => a.job_id))];
        let jobsList: { id: string; title: string }[] = [];
        if (targetJobIds.length > 0) {
          const { data: jData } = await supabase
            .schema("job")
            .from("jobs")
            .select("id, title")
            .in("id", targetJobIds);
          jobsList = jData || [];
        }

        const mapped: RecruiterInterviewItem[] = [];

        // Map database interviews
        for (const meet of rawMeetings) {
          const app = appList.find((a) => a.id === meet.application_id);
          const cand = app ? candsList.find((c) => c.id === app.candidate_id) : null;
          const job = app ? jobsList.find((j) => j.id === app.job_id) : null;

          mapped.push({
            id: meet.id,
            candidate_name: cand ? `${cand.first_name} ${cand.last_name}` : "Applicant Candidate",
            job_title: job ? job.title : "Technical Position",
            interview_type: meet.type || meet.interview_type || "Technical Interview",
            status: meet.status || "scheduled",
            scheduled_at: meet.start_time || meet.scheduled_at || new Date().toISOString(),
            duration_minutes: meet.duration_minutes || 60,
            meeting_link: meet.meeting_link,
            candidate_id: cand?.id,
          });
        }

        // Fallback for applications in 'interview' stage without explicit interview row
        for (const app of appList) {
          if ((app.status === "interview" || app.interview_scheduled_at) && !mapped.some((m) => m.id.includes(app.id))) {
            const cand = candsList.find((c) => c.id === app.candidate_id);
            const job = jobsList.find((j) => j.id === app.job_id);

            mapped.push({
              id: app.id,
              candidate_name: cand ? `${cand.first_name} ${cand.last_name}` : "Applicant Candidate",
              job_title: job ? job.title : "Technical Position",
              interview_type: "AI Technical Video Interview",
              status: "scheduled",
              scheduled_at: app.interview_scheduled_at || new Date().toISOString(),
              duration_minutes: 60,
              meeting_link: undefined,
              candidate_id: cand?.id,
            });
          }
        }

        setInterviews(mapped);
      } catch (err) {
        logger.error("Failed to load recruiter interviews overview", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllInterviews();
  }, []);

  const filteredInterviews = React.useMemo(() => {
    return interviews.filter((int) => {
      const matchesSearch =
        int.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        int.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        int.interview_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || int.status.toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [interviews, searchQuery, statusFilter]);

  const groupedInterviews = React.useMemo(() => {
    const groups: Record<string, RecruiterInterviewItem[]> = {};
    filteredInterviews.forEach((int) => {
      const title = int.job_title || "Technical Position";
      if (!groups[title]) groups[title] = [];
      groups[title].push(int);
    });
    return groups;
  }, [filteredInterviews]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-50 text-blue-600 border-blue-200",
      completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
      cancelled: "bg-red-50 text-red-600 border-red-200",
    };
    const styleClass = styles[status.toLowerCase()] || "bg-zinc-100 text-zinc-700 border-zinc-200";
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${styleClass}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0071E3]" />
      </div>
    );
  }

  const jobTitles = Object.keys(groupedInterviews);

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto py-2 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E8ED] pb-5">
        <div>
          <span className="text-[11px] font-bold text-[#0071E3] uppercase tracking-wider block">
            Recruiter Workspace
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] mt-1">
            Interview Schedules & Panel Loops
          </h1>
          <p className="text-xs text-[#6E6E73] mt-1">
            Manage all company interview panels grouped by job position.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3FF] border border-[#C5DCFF] px-3 py-1 text-xs font-bold text-[#0071E3]">
            <Video className="h-3.5 w-3.5" />
            {interviews.length} Total Interviews
          </span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#D2D2D7] shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#AEAEB2]" />
          <input
            type="text"
            placeholder="Search candidate, job, or round type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] pl-9 pr-4 py-2 text-xs font-medium text-[#1D1D1F] focus:bg-white focus:border-[#0071E3] focus:outline-none transition-all"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-[#6E6E73] shrink-0 mr-1" />
          {["all", "scheduled", "completed", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all shrink-0 ${
                statusFilter === st
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#E8E8ED] hover:text-[#1D1D1F]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Interviews List */}
      <div className="space-y-8">
        {jobTitles.map((jobTitle) => {
          const list = groupedInterviews[jobTitle];
          return (
            <div key={jobTitle} className="space-y-4">
              {/* Job Section Banner */}
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-[#D2D2D7] shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3FF] border border-[#C5DCFF] text-[#0071E3]">
                    <Briefcase className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1D1D1F]">{jobTitle}</h2>
                    <p className="text-[11px] text-[#6E6E73] font-medium">Job Opening</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-[#F5F5F7] border border-[#D2D2D7] px-3 py-1 text-xs font-bold text-[#1D1D1F]">
                  {list.length} {list.length === 1 ? "Interview" : "Interviews"}
                </span>
              </div>

              {/* Cards Grid for this Job */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-1">
                {list.map((int) => (
                  <div
                    key={int.id}
                    className="rounded-2xl border border-[#D2D2D7] bg-white p-5 flex flex-col justify-between gap-4 text-left shadow-sm hover:border-[#AEAEB2] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-[#E8E8ED] pb-3">
                        <div className="flex items-center gap-3">
                          <CandidateAvatar name={int.candidate_name} />
                          <div>
                            <h3 className="text-sm font-bold text-[#1D1D1F]">{int.candidate_name}</h3>
                            <span className="text-[11px] text-[#6E6E73]">Candidate</span>
                          </div>
                        </div>
                        {getStatusBadge(int.status)}
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-[#F5F5F7] border border-[#D2D2D7] px-2 py-0.5 text-[11px] font-semibold text-[#1D1D1F] capitalize">
                            {int.interview_type.replace("-", " ")} Round
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-[#6E6E73] font-medium pt-1">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-[#0071E3]" />
                            <span>{new Date(int.scheduled_at).toLocaleString()}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#0071E3]" />
                            <span>{int.duration_minutes} min</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#E8E8ED] pt-3 shrink-0">
                      <a
                        href={`/recruiter/interviews/${int.id}`}
                        className="text-xs font-bold text-[#0071E3] hover:underline flex items-center gap-1"
                      >
                        Audit AI Scorecard & Video →
                      </a>

                      <Link
                        href={getSmartHireRoomUrl(int)}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
                      >
                        <Video className="h-3.5 w-3.5 text-emerald-300" /> Launch SmartHire Room
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {jobTitles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#D2D2D7] bg-white p-12 text-center text-[#6E6E73] italic text-sm">
            No interviews matching the selected criteria.
          </div>
        )}
      </div>
    </div>
  );
}
