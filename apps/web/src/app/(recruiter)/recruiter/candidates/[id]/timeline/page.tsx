"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { ActivityFeed, ActivityItem } from "@/components/candidates/ActivityFeed";
import { Loader2 } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const appClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "application" } });

export default function CandidateTimelinePage() {
  const params = useParams();
  const candidateId = params.id as string;

  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchActivities = async () => {
      try {
        // Fetch application matching candidate ID
        const { data: app, error } = await appClient
          .from("applications")
          .select("id, created_at, status")
          .eq("candidate_id", candidateId)
          .is("deleted_at", null)
          .maybeSingle();

        if (error) throw error;

        const timelineList: ActivityItem[] = [];

        if (app) {
          // Add Application Submission Event
          timelineList.push({
            id: "applied-event",
            type: "applied",
            content: "Application submitted to Job opening",
            timestamp: app.created_at,
          });

          // Fetch status history logs
          const { data: logs } = await appClient
            .from("application_status_history")
            .select("id, from_status, to_status, created_at")
            .eq("application_id", app.id)
            .order("created_at", { ascending: false });

          if (logs) {
            logs.forEach((log) => {
              timelineList.push({
                id: log.id,
                type: log.to_status === "rejected" ? "note" : log.to_status === "offered" ? "offer" : "screening",
                content: `Pipeline stage transition: moved from ${log.from_status} to ${log.to_status}`,
                timestamp: log.created_at,
              });
            });
          }
        }

        // Sort all events by timestamp descending
        timelineList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivities(timelineList);
      } catch (err) {
        logger.error("Failed to load candidate timeline activities", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/30 p-6 text-left animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-850 pb-3">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">Chronological platform activities</h3>
        <span className="text-xs text-zinc-550 font-mono">
          Total Logs: {activities.length}
        </span>
      </div>

      <ActivityFeed activities={activities} />
    </div>
  );
}
