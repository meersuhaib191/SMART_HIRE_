"use client";

import * as React from "react";
import { Loader2, Calendar, Video, Clock, Briefcase, Search, Filter, CheckCircle2, Trophy, Lock } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface CandidateInterview {
  id: string;
  interview_type: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  meeting_link?: string;
  job_title?: string;
  source?: string; // 'scheduled' | 'ai_interview'
}

export default function CandidateInterviewsPage() {
  const [interviews, setInterviews] = React.useState<CandidateInterview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  React.useEffect(() => {
    const fetchInterviews = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { setLoading(false); return; }

        // Get candidate profile id
        const { data: prof } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!prof?.id) { setLoading(false); return; }

        // Fetch interviews via SECURITY DEFINER RPC (bypasses cross-schema RLS on interview.interviews)
        const { data: rows, error: rpcErr } = await supabase.rpc("get_candidate_interviews", {
          p_candidate_id: prof.id,
        });

        if (rpcErr) {
          logger.error("Failed to load candidate interviews schedule", rpcErr);
          setLoading(false);
          return;
        }

        // Fetch job titles for all job_ids returned
        const jobIds = [...new Set((rows || []).map((r: any) => r.job_id).filter(Boolean))];
        let jobsList: { id: string; title: string }[] = [];
        if (jobIds.length > 0) {
          const { data: jList } = await supabase
            .schema("job")
            .from("jobs")
            .select("id, title")
            .in("id", jobIds);
          jobsList = jList || [];
        }

        const mapped: CandidateInterview[] = (rows || [])
          .filter((r: any) => r.status !== "rescheduled")
          .map((r: any) => {
            const job = jobsList.find((j) => j.id === r.job_id);
            return {
              id: r.id,
              interview_type: r.meeting_title || r.type || "Technical Interview",
              status: r.status || "scheduled",
              scheduled_at: r.start_time || null,
              duration_minutes: r.duration_minutes || 60,
              meeting_link: r.meeting_link || undefined,
              job_title: job?.title || "Software Engineering Position",
              source: r.source || "scheduled",
            };
          });

        setInterviews(mapped);
      } catch (err) {
        logger.error("Failed to load candidate interviews schedule", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviews();
  }, []);


  const filteredInterviews = React.useMemo(() => {
    return interviews.filter((int) => {
      const title = int.job_title || "Technical Position";
      const matchesSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        int.interview_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || int.status.toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [interviews, searchQuery, statusFilter]);

  const groupedInterviews = React.useMemo(() => {
    const groups: Record<string, CandidateInterview[]> = {};
    filteredInterviews.forEach((int) => {
      const jobName = int.job_title || "Technical Position";
      if (!groups[jobName]) {
        groups[jobName] = [];
      }
      groups[jobName].push(int);
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500 font-medium">Loading interview schedules...</p>
      </div>
    );
  }

  const jobTitles = Object.keys(groupedInterviews);
  const scheduledCount = interviews.filter((i) => i.status.toLowerCase() === "scheduled").length;
  const completedCount = interviews.filter((i) => i.status.toLowerCase() === "completed").length;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 text-left animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
          Candidate Portal
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Scheduled Interviews & AI Video Lobbies
        </h1>
        <p className="text-sm text-zinc-500 font-medium">
          Review date & time schedules, panel durations, and launch live video rooms grouped by job position.
        </p>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Interviews", value: interviews.length, icon: Calendar, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "Upcoming Loops", value: scheduledCount, icon: Video, color: "text-purple-600 bg-purple-50 border-purple-100" },
          { label: "Completed Panels", value: completedCount, icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 flex items-center gap-4 ${stat.color.split(" ").slice(1).join(" ")}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color.split(" ")[0]} ${stat.color.split(" ")[1]}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-zinc-900 tabular-nums">{stat.value}</p>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search job title or round..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2 text-xs font-medium text-zinc-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0 mr-1" />
          {["all", "scheduled", "completed", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all shrink-0 ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Interviews list grouped by jobs */}
      <div className="space-y-8">
        {jobTitles.map((jobTitle) => {
          const jobInterviews = groupedInterviews[jobTitle];
          const activeRound = jobInterviews[0]; // Exactly 1 deduplicated active instance per job position
          if (!activeRound) return null;

          return (
            <div key={jobTitle} className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4 text-left shadow-sm hover:shadow-md transition-all">
              {/* Job Banner Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600 font-bold">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-zinc-900">{jobTitle}</h2>
                    <p className="text-[11px] text-zinc-500 font-medium">Applied Position · {jobInterviews.length} round{jobInterviews.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  Active Interview Stage
                </span>
              </div>

              {/* All interview rounds for this job */}
              <div className="space-y-3">
                {jobInterviews.map((round) => {
                  const isAI = round.source === "ai_interview";
                  return (
                    <div
                      key={round.id}
                      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isAI
                          ? "bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200"
                          : "bg-zinc-50/40 border-zinc-200"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {isAI && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-full">AI Round</span>
                          )}
                          <h3 className="text-sm font-bold text-zinc-900">
                            {round.interview_type}
                          </h3>
                          {getStatusBadge(round.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium flex-wrap">
                          {round.scheduled_at ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                              <span>{new Date(round.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-violet-600">
                              <Video className="h-3.5 w-3.5 shrink-0" />
                              <span>Available now · Start when ready</span>
                            </div>
                          )}
                          <span>•</span>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                            <span>{round.duration_minutes} mins</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {round.status.toLowerCase() === "completed" ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4" /> Completed
                          </span>
                        ) : isAI ? (
                          <a
                            href={`/candidate/ai-interview/${round.id}/exam`}
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl px-4 py-2 text-xs font-bold h-9 shadow-sm transition-all"
                          >
                            <Video className="h-4 w-4" /> Start Gemini Live Interview
                          </a>
                        ) : round.meeting_link ? (
                          (() => {
                            const scheduledMs = round.scheduled_at ? new Date(round.scheduled_at).getTime() : 0;
                            const diffMins = scheduledMs ? (scheduledMs - Date.now()) / (1000 * 60) : 0;
                            const isTooEarly = diffMins > 10;

                            if (isTooEarly) {
                              const minsLeft = Math.ceil(diffMins);
                              return (
                                <button
                                  disabled
                                  title="Google Meet room opens 10 minutes before scheduled start time"
                                  className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3.5 py-2 text-xs font-bold h-9 cursor-not-allowed shadow-2xs"
                                >
                                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                                  <span>Opens in {minsLeft > 60 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : `${minsLeft}m`}</span>
                                </button>
                              );
                            }

                            return (
                              <a
                                href={round.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-bold h-9 shadow-sm transition-all"
                              >
                                <Video className="h-4 w-4 text-emerald-300" /> Enter Google Meet
                              </a>
                            );
                          })()
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-400 rounded-xl px-4 py-2 text-xs font-bold h-9 cursor-not-allowed"
                          >
                            <Lock className="h-3.5 w-3.5" /> Awaiting Schedule
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {jobTitles.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-500 italic text-sm">
            No interview loops matching your query.
          </div>
        )}
      </div>
    </div>
  );
}


