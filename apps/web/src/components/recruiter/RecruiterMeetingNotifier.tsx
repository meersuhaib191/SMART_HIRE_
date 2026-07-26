"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Video, Calendar, Clock, X, ArrowRight, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@smarthire/ui";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logger } from "@smarthire/logger";

interface ScheduledMeetingNotice {
  id: string;
  meetingToken: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  startTime: string | null;
  durationMinutes: number;
  status: string;
}

export function RecruiterMeetingNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [meeting, setMeeting] = React.useState<ScheduledMeetingNotice | null>(null);
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);
  const [minimized, setMinimized] = React.useState(false);

  // Do not render popup when already inside an interview room or lobby
  const isInterviewPage = pathname?.startsWith("/interview");

  const checkScheduledMeetings = React.useCallback(async () => {
    if (!isAuthenticated || !user || isInterviewPage) return;

    try {
      const supabase = createClient();
      const userAuth = await supabase.auth.getUser().catch(() => null);
      const activeUser = userAuth?.data?.user;
      if (!activeUser) return;

      // 1. Check if user belongs to recruiter organization
      const { data: recruiter } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("company_id")
        .eq("user_id", activeUser.id)
        .maybeSingle();

      const companyId = recruiter?.company_id;

      // 2. Fetch interviews in scheduled or in-progress status
      let query = supabase
        .schema("interview")
        .from("interviews")
        .select(`
          id,
          application_id,
          meeting_title,
          meeting_token,
          start_time,
          duration_minutes,
          status,
          candidate_id
        `)
        .in("status", ["scheduled", "in-progress"])
        .order("start_time", { ascending: true });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data: ints } = await query;

      if (ints && ints.length > 0) {
        const firstInt = ints[0];

        // Fetch application & job title & candidate details
        const { data: app } = await supabase
          .schema("application")
          .from("applications")
          .select("id, job_id, candidate_id")
          .eq("id", firstInt.application_id)
          .maybeSingle();

        let jobTitle = "Software Engineering Position";
        if (app?.job_id) {
          const { data: job } = await supabase
            .schema("job")
            .from("jobs")
            .select("title")
            .eq("id", app.job_id)
            .maybeSingle();
          if (job?.title) jobTitle = job.title;
        }

        let candName = "Candidate";
        let candEmail = "";
        const targetCandId = firstInt.candidate_id || app?.candidate_id;
        if (targetCandId) {
          const { data: cand } = await supabase
            .schema("candidate")
            .from("candidates")
            .select("first_name, last_name, email")
            .eq("id", targetCandId)
            .maybeSingle();
          if (cand) {
            candName = `${cand.first_name || ""} ${cand.last_name || ""}`.trim() || "Candidate";
            candEmail = cand.email || "";
          }
        }

        const meetingToken = firstInt.meeting_token || `smh_meet_${firstInt.id}`;

        setMeeting({
          id: firstInt.id,
          meetingToken,
          jobTitle,
          candidateName: candName,
          candidateEmail: candEmail,
          startTime: firstInt.start_time,
          durationMinutes: firstInt.duration_minutes || 60,
          status: firstInt.status,
        });
        return;
      }

      // 3. Fallback: check candidate applications in zoom_interview status
      let appQuery = supabase
        .schema("application")
        .from("applications")
        .select("id, job_id, candidate_id, interview_scheduled_at")
        .eq("status", "zoom_interview")
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: zoomApps } = await appQuery;
      if (zoomApps && zoomApps.length > 0) {
        const appRow = zoomApps[0];

        let jobTitle = "Full Stack Position";
        if (appRow.job_id) {
          const { data: job } = await supabase
            .schema("job")
            .from("jobs")
            .select("title")
            .eq("id", appRow.job_id)
            .maybeSingle();
          if (job?.title) jobTitle = job.title;
        }

        let candName = "Candidate";
        let candEmail = "";
        if (appRow.candidate_id) {
          const { data: cand } = await supabase
            .schema("candidate")
            .from("candidates")
            .select("first_name, last_name, email")
            .eq("id", appRow.candidate_id)
            .maybeSingle();
          if (cand) {
            candName = `${cand.first_name || ""} ${cand.last_name || ""}`.trim() || "Candidate";
            candEmail = cand.email || "";
          }
        }

        const fallbackToken = `smh_meet_app_int_${appRow.id}`;
        setMeeting({
          id: `app_${appRow.id}`,
          meetingToken: fallbackToken,
          jobTitle,
          candidateName: candName,
          candidateEmail: candEmail,
          startTime: appRow.interview_scheduled_at || new Date().toISOString(),
          durationMinutes: 60,
          status: "scheduled",
        });
      }
    } catch (err) {
      logger.warn("[RecruiterMeetingNotifier] Fetch error", err);
    }
  }, [isAuthenticated, user, isInterviewPage]);

  React.useEffect(() => {
    checkScheduledMeetings();
    const interval = setInterval(checkScheduledMeetings, 25000);
    return () => clearInterval(interval);
  }, [checkScheduledMeetings]);

  if (isInterviewPage || !meeting || meeting.id === dismissedId) {
    return null;
  }

  const handleJoin = () => {
    router.push(`/interview/lobby/${meeting.meetingToken}`);
  };

  const formattedTime = meeting.startTime
    ? new Date(meeting.startTime).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Scheduled Now";

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl font-bold text-xs border border-indigo-400/30 transition-all"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span>Interview Ready ({meeting.candidateName})</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-zinc-950/95 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-5 shadow-2xl text-white font-sans transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
            Recruiter Live Interview Ready
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(true)}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 text-xs font-bold"
            title="Minimize"
          >
            _
          </button>
          <button
            onClick={() => setDismissedId(meeting.id)}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-indigo-400 inline shrink-0" />
              {meeting.candidateName}
            </h4>
            <p className="text-xs font-medium text-zinc-400 mt-0.5">{meeting.jobTitle}</p>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 shrink-0">
            {meeting.durationMinutes}m Session
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/80 px-3 py-2 rounded-xl border border-zinc-800">
          <Clock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="font-semibold">{formattedTime}</span>
        </div>
      </div>

      {/* Call to Action */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleJoin}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Video className="h-4 w-4" />
          Enter SmartHire Video Room
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
