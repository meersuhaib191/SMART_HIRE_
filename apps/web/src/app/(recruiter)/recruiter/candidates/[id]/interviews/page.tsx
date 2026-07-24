"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { Loader2, Calendar, Video, User, Briefcase } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase clients for schemas
const appClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "application" } });
const intClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "interview" } });
const jobClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "job" } });

interface InterviewDetails {
  id: string;
  interview_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string;
  instructions?: string;
  job_title?: string;
}

export default function CandidateInterviewsPage() {
  const params = useParams();
  const candidateId = params.id as string;

  const [interviews, setInterviews] = React.useState<InterviewDetails[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchInterviews = async () => {
      try {
        // Query candidate's applications
        const { data: apps } = await appClient
          .from("applications")
          .select("id, job_id")
          .eq("candidate_id", candidateId)
          .is("deleted_at", null);

        if (apps && apps.length > 0) {
          const appIds = apps.map((a) => a.id);
          const jobIds = apps.map((a) => a.job_id);

          const { data: jobs } = await jobClient
            .from("jobs")
            .select("id, title")
            .in("id", jobIds);

          // Query interviews matching application IDs
          const { data: rawInterviews, error } = await intClient
            .from("interviews")
            .select("id, application_id, interview_type, status, scheduled_at, duration_minutes, meeting_link, instructions")
            .in("application_id", appIds);

          if (error) throw error;

          const mapped: InterviewDetails[] = (rawInterviews || []).map((int) => {
            const app = apps.find((a) => a.id === int.application_id);
            const job = app ? (jobs || []).find((j) => j.id === app.job_id) : null;
            return {
              ...int,
              job_title: job ? job.title : "Technical Position",
            };
          });

          setInterviews(mapped);
        } else {
          setInterviews([]);
        }
      } catch (err) {
        logger.error("Failed to load candidate interviews", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviews();
  }, [candidateId]);

  const groupedInterviews = React.useMemo(() => {
    const groups: Record<string, InterviewDetails[]> = {};
    interviews.forEach((int) => {
      const title = int.job_title || "Technical Position";
      if (!groups[title]) groups[title] = [];
      groups[title].push(int);
    });
    return groups;
  }, [interviews]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
    };
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    const styleClass = styles[status] || "bg-zinc-550/10 text-zinc-555 border-zinc-550/20";

    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styleClass}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  const jobTitles = Object.keys(groupedInterviews);

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/30 p-6 text-left animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-850 pb-3">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150 flex items-center gap-1.5">
          <Calendar className="h-5 w-5 text-zinc-450" /> Scheduled interview loops
        </h3>
        <span className="text-xs text-zinc-555 font-mono">
          Total Loops: {interviews.length}
        </span>
      </div>

      {interviews.length === 0 ? (
        <div className="text-center py-12 text-zinc-555 text-sm">
          No recruiters panel or technical interviews scheduled yet.
        </div>
      ) : (
        <div className="space-y-6">
          {jobTitles.map((jobTitle) => {
            const list = groupedInterviews[jobTitle];
            return (
              <div key={jobTitle} className="space-y-3">
                {/* Job Header */}
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/60 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{jobTitle}</span>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                    {list.length} {list.length === 1 ? "Round" : "Rounds"}
                  </span>
                </div>

                {/* Interviews */}
                <div className="space-y-3 pl-1">
                  {list.map((int) => (
                    <div
                      key={int.id}
                      className="rounded-xl border border-zinc-200/50 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Left Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-200 capitalize">
                            {int.interview_type.replace("-", " ")} Round
                          </h4>
                          {getStatusBadge(int.status)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>{new Date(int.scheduled_at).toLocaleString()}</span>
                          </div>
                          <span>•</span>
                          <span>{int.duration_minutes} min duration</span>
                        </div>

                        {int.instructions && (
                          <p className="text-xs text-zinc-650 dark:text-zinc-400 max-w-md italic leading-normal">
                            Instructions: &quot;{int.instructions}&quot;
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 shrink-0">
                        {int.meeting_link ? (
                          <a
                            href={int.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg px-4 py-2 text-xs font-semibold h-9 shadow-sm"
                          >
                            <Video className="h-4 w-4" /> Join Video Call
                          </a>
                        ) : (
                          <span className="text-zinc-555 text-xs italic">No Link Linked</span>
                        )}

                        <div className="h-9 w-9 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-500" title="Assigned Interviewers">
                          <User className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

