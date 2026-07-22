"use client";

import * as React from "react";
import { Loader2, Calendar, Video, Clock } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface CandidateInterview {
  id: string;
  interview_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string;
  job_title?: string;
}

export default function CandidateInterviewsPage() {
  const [interviews, setInterviews] = React.useState<CandidateInterview[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchInterviews = async () => {
      try {
        // Query candidate active interview loops
        const { data: meetings, error } = await supabase
          .schema("interview")
          .from("interviews")
          .select("*");

        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawList: any[] = meetings || [];
        if (rawList.length > 0) {
          const appIds = rawList.map((m) => m.application_id);
          const { data: apps } = await supabase.schema("application").from("applications").select("id, job_id").in("id", appIds);

          let jobsList: { id: string; title: string }[] = [];
          if (apps && apps.length > 0) {
            const jIds = apps.map((a) => a.job_id);
            const { data: jobs } = await supabase.schema("job").from("jobs").select("id, title").in("id", jIds);
            jobsList = jobs || [];
          }

          const mapped: CandidateInterview[] = rawList.map((meet) => {
            const app = (apps || []).find((a) => a.id === meet.application_id);
            const job = app ? jobsList.find((j) => j.id === app.job_id) : null;

            return {
              id: meet.id,
              interview_type: meet.type || meet.interview_type || "Technical",
              status: meet.status || "scheduled",
              scheduled_at: meet.start_time || meet.scheduled_at || new Date().toISOString(),
              duration_minutes: meet.duration_minutes || 60,
              meeting_link: meet.meeting_link,
              job_title: job ? job.title : "Technical Position",
            };
          });

          setInterviews(mapped);
        } else {
          setInterviews([]);
        }
      } catch (err) {
        logger.error("Failed to load candidate interviews schedule", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviews();
  }, []);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-50/20 text-blue-600 border-blue-200",
      completed: "bg-emerald-50/20 text-emerald-600 border-emerald-200",
      cancelled: "bg-red-50/20 text-red-600 border-red-200",
    };
    const styleClass = styles[status] || "bg-zinc-100 text-zinc-700 border-zinc-200";
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold capitalize ${styleClass}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-4xl mx-auto py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
          Candidate Portal
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
          Your Scheduled Interviews
        </h1>
        <p className="text-sm text-zinc-700 mt-1">
          Check dates, times, durational lengths, and join live technical panels.
        </p>
      </div>

      {/* Interviews list */}
      <div className="space-y-4">
        {interviews.map((int) => (
          <div
            key={int.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-sm hover:border-zinc-300 transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-zinc-900 capitalize">
                  {int.interview_type.replace("-", " ")} Round
                </h3>
                {getStatusBadge(int.status)}
              </div>
              <p className="text-xs text-zinc-800 font-medium">Applied Job: {int.job_title}</p>
              <div className="flex items-center gap-3.5 text-xs text-zinc-700 font-medium">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{new Date(int.scheduled_at).toLocaleString()}</span>
                </div>
                <span>â€¢</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{int.duration_minutes} Mins</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/candidate/interview/${int.id}/room`}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg px-4 py-2 text-xs font-bold h-9 shadow-sm transition-all"
              >
                <Video className="h-4 w-4" /> Enter AI Video Room
              </a>
            </div>
          </div>
        ))}

        {interviews.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-700 italic text-sm">
            No upcoming interview loops scheduled.
          </div>
        )}
      </div>
    </div>
  );
}
