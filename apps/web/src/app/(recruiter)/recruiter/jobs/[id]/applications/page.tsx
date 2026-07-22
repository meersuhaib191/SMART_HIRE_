"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { Button } from "@smarthire/ui";
import { FileDown, Calendar, Loader2 } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client for candidate schema
const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });

interface Application {
  id: string;
  candidate_id: string;
  resume_id?: string;
  status: string;
  created_at: string;
  score?: number | null;
  candidate?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export default function JobApplicationsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const fetchApplications = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/applications?jobId=${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch applications");
      const { data } = await res.json();

      const appsList: Application[] = data || [];

      // Query candidate names for each application using candidate schema client
      if (appsList.length > 0) {
        const candidateIds = appsList.map((a) => a.candidate_id);
        const { data: candidates, error } = await candClient
          .from("candidates")
          .select("id, first_name, last_name, email")
          .in("id", candidateIds);

        if (error) throw error;

        // Map candidates back to applications
        const mapped = appsList.map((app) => {
          const cand = (candidates || []).find((c) => c.id === app.candidate_id);
          return {
            ...app,
            candidate: cand
              ? {
                  first_name: cand.first_name,
                  last_name: cand.last_name,
                  email: cand.email,
                }
              : undefined,
          };
        });
        setApplications(mapped);
      } else {
        setApplications([]);
      }
    } catch (err) {
      logger.error("Failed to load applications list", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleStageTransition = async (appId: string, newStatus: string) => {
    setUpdatingId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Transition failed");

      // Optimistic Update
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app))
      );
    } catch (err) {
      logger.error("Failed to update application status", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      applied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      screening: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      mcq: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      coding: "bg-pink-500/10 text-pink-500 border-pink-500/20",
      interview: "bg-teal-500/10 text-teal-500 border-teal-500/20",
      offered: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      rejected: "bg-red-500/10 text-red-500 border-red-500/20",
      withdrawn: "bg-zinc-500/10 text-zinc-555 border-zinc-550/20",
    };

    const label = status === "screening"
      ? "Profile Screening"
      : status === "mcq"
      ? "MCQ Test"
      : status === "coding"
      ? "Coding Round"
      : status === "interview"
      ? "Interview"
      : status.charAt(0).toUpperCase() + status.slice(1);
    const styleClass = (styles as Record<string, string>)[status] || "bg-zinc-500/10 text-zinc-555 border-zinc-550/20";

    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styleClass}`}>
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

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/30 p-6 text-left animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150">Applicant pipeline</h3>
        <span className="text-xs text-zinc-550 font-mono">
          Total Candidates: {applications.length}
        </span>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-12 text-zinc-555 text-sm">
          No candidates have applied for this job opening yet.
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/30">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-zinc-150 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950/60 text-zinc-550 dark:text-zinc-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Candidate Details</th>
                <th className="p-4">Applied Date</th>
                <th className="p-4">Current Stage</th>
                <th className="p-4">Obtained Score</th>
                <th className="p-4">Resume</th>
                <th className="p-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850 text-zinc-700 dark:text-zinc-300">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-zinc-900/35 transition-colors">
                  <td className="p-4">
                    <div className="space-y-0.5 text-left">
                      <p className="font-bold text-sm text-zinc-200">
                        {app.candidate
                          ? `${app.candidate.first_name} ${app.candidate.last_name}`
                          : "Jane Doe"}
                      </p>
                      <p className="text-[10px] text-zinc-555">{app.candidate?.email || "candidate@email.com"}</p>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {getStatusBadge(app.status)}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 bg-[#FFF8EE] border border-[#FFE8C2] text-[#C07A00] px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {app.score || 2}/10 Points
                    </span>
                  </td>
                  <td className="p-4">
                    {app.resume_id ? (
                      <a
                        href={`/api/candidate/resumes/${app.resume_id}/download`}
                        className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-450 hover:underline font-semibold"
                        title="Download Resume file"
                      >
                        <FileDown className="h-4 w-4" /> Download
                      </a>
                    ) : (
                      <span className="text-zinc-555 italic">None</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {updatingId === app.id ? (
                        <Loader2 className="h-4.5 w-4.5 animate-spin text-zinc-400" />
                      ) : (
                        <>
                          {app.status === "applied" && (
                            <Button
                              variant="outline"
                              onClick={() => handleStageTransition(app.id, "screening")}
                              className="border-zinc-850 hover:bg-zinc-900 text-xs py-1 h-8 text-zinc-350"
                            >
                              Move Profile Screening
                            </Button>
                          )}
                          {app.status === "screening" && (
                            <Button
                              variant="outline"
                              onClick={() => handleStageTransition(app.id, "mcq")}
                              className="border-zinc-850 hover:bg-zinc-900 text-xs py-1 h-8 text-zinc-350"
                            >
                              Move MCQ Test
                            </Button>
                          )}
                          {app.status === "mcq" && (
                            <Button
                              variant="outline"
                              onClick={() => handleStageTransition(app.id, "coding")}
                              className="border-zinc-850 hover:bg-zinc-900 text-xs py-1 h-8 text-zinc-350"
                            >
                              Move Coding Round
                            </Button>
                          )}
                          {app.status === "coding" && (
                            <Button
                              variant="outline"
                              onClick={() => handleStageTransition(app.id, "interview")}
                              className="border-zinc-850 hover:bg-zinc-900 text-xs py-1 h-8 text-zinc-350"
                            >
                              Move Interview
                            </Button>
                          )}
                          {app.status === "interview" && (
                            <Button
                              variant="outline"
                              onClick={() => handleStageTransition(app.id, "offered")}
                              className="border-zinc-850 hover:bg-zinc-900 text-xs py-1 h-8 text-zinc-350"
                            >
                              Move Offer
                            </Button>
                          )}
                          {app.status !== "rejected" && (
                            <Button
                              variant="outline"
                              onClick={() => handleStageTransition(app.id, "rejected")}
                              className="border-red-950 bg-red-950/10 text-red-500 hover:bg-red-950/20 text-xs py-1 h-8"
                            >
                              Reject
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
