"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Calendar, ArrowRight, Clock, Sparkles } from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface AssignmentDetails {
  id: string;
  scheduled_start_at?: string | null;
  expires_at?: string | null;
  status: string;
  isReady: boolean;
}

interface ActiveApplication {
  id: string;
  created_at: string;
  status: string;
  job_title: string;
  job_id: string;
  score?: number | null;
  assignment?: AssignmentDetails | null;
}

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = React.useState<ActiveApplication[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchApplications = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        let { data: profile } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!profile) {
          const { data: newProfile, error: insErr } = await supabase
            .schema("candidate")
            .from("candidates")
            .insert({
              user_id: authUser.id,
              email: authUser.email || "",
              first_name: authUser.user_metadata?.first_name || authUser.email?.split("@")[0] || "Candidate",
              last_name: authUser.user_metadata?.last_name || "",
              summary: "",
              tags: ["React", "TypeScript"]
            })
            .select("id")
            .single();

          if (insErr) throw insErr;
          profile = newProfile;
        }

        if (profile) {
          const { data: apps, error } = await supabase
            .schema("application")
            .from("applications")
            .select("id, created_at, status, job_id, score")
            .eq("candidate_id", profile.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (error) throw error;

          if (apps && apps.length > 0) {
            const jobIds = apps.map((a) => a.job_id);
            const { data: jobs } = await supabase
              .schema("job")
              .from("jobs")
              .select("id, title, mcq_scheduled_start_at, coding_scheduled_start_at")
              .in("id", jobIds);

            const { data: assignments } = await supabase
              .schema("assessment")
              .from("assignments")
              .select("id, application_id, assessment_id, status, scheduled_start_at, expires_at")
              .eq("candidate_id", profile.id);

            const now = new Date();

            const mapped: ActiveApplication[] = apps.map((app) => {
              const job = (jobs || []).find((j) => j.id === app.job_id);
              const matchingAssignment = (assignments || []).find((as) => as.application_id === app.id);

              const schedStart = matchingAssignment?.scheduled_start_at || (
                app.status === "mcq" ? job?.mcq_scheduled_start_at :
                app.status === "coding" ? job?.coding_scheduled_start_at : null
              );

              let isReady = false;
              if (schedStart) {
                const startTime = new Date(schedStart);
                const notExpired = !matchingAssignment?.expires_at || new Date(matchingAssignment.expires_at) > now;
                isReady = startTime <= now && notExpired && matchingAssignment?.status !== "completed";
              } else if (matchingAssignment && matchingAssignment.status !== "completed") {
                isReady = true;
              }

              const assignmentDetails: AssignmentDetails | null = (matchingAssignment || schedStart) ? {
                id: matchingAssignment?.id || app.id,
                scheduled_start_at: schedStart,
                expires_at: matchingAssignment?.expires_at,
                status: matchingAssignment?.status || "assigned",
                isReady,
              } : null;

              return {
                id: app.id,
                created_at: app.created_at,
                status: app.status,
                job_title: job ? job.title : "Hiring opening",
                job_id: app.job_id,
                score: app.score,
                assignment: assignmentDetails,
              };
            });
            setApplications(mapped);
          } else {
            setApplications([]);
          }
        }
      } catch (err) {
        logger.error("Failed to load candidate applications list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const getStatusColor = (status: string) => {
    const styles: Record<string, string> = {
      applied: "bg-blue-50/20 text-blue-600 border-blue-200",
      screening: "bg-purple-50/20 text-purple-600 border-purple-200",
      mcq: "bg-indigo-50/20 text-indigo-600 border-indigo-200",
      coding: "bg-pink-50/20 text-pink-600 border-pink-200",
      interview: "bg-teal-50/20 text-teal-600 border-teal-200",
      offered: "bg-emerald-50/20 text-emerald-600 border-emerald-200",
      rejected: "bg-red-50/20 text-red-600 border-red-200",
      withdrawn: "bg-zinc-100 text-zinc-700 border-zinc-200",
    };
    return styles[status] || "bg-zinc-100 text-zinc-700 border-zinc-200";
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
          Your active applications
        </h1>
        <p className="text-sm text-zinc-700 mt-1">
          Follow active pipelines progression milestones, interviews booking, and direct exam round entrances.
        </p>
      </div>

      {/* Applications List */}
      <div className="space-y-4.5">
        {applications.map((app) => {
          const getActiveStageIndex = (status: string) => {
            switch (status) {
              case "applied": return 0;
              case "screening": return 1;
              case "mcq": return 2;
              case "coding": return 3;
              case "interview":
              case "offered":
              case "accepted":
              case "hired": return 4;
              default: return 0;
            }
          };

          return (
            <div
              key={app.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-4 text-left shadow-sm hover:border-zinc-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-zinc-900">{app.job_title}</h3>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold capitalize ${getStatusColor(app.status)}`}>
                      {app.status === "screening"
                        ? "Profile Screening"
                        : app.status === "mcq"
                        ? "MCQ Test"
                        : app.status === "coding"
                        ? "Coding Round"
                        : app.status === "interview"
                        ? "Interview"
                        : app.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-700 font-medium">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span>Applied {new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/candidate/jobs/${app.job_id}`}>
                    <Button className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-9 px-4 text-xs font-bold rounded-lg shadow-sm">
                      View Job Details <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Informative Active Round Notice & Direct Direct Entrance Button */}
              {app.status === "mcq" && (
                <div className="pt-2 border-t border-zinc-100">
                  <div className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 to-blue-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          {app.assignment?.isReady ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                          )}
                        </span>
                        <span className="text-xs font-bold text-indigo-950">
                          MCQ Assessment Round
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                        {!app.assignment?.scheduled_start_at ? (
                          "Notice: The MCQ test round shall start soon. Date & time will be scheduled by recruiter shortly."
                        ) : app.assignment.isReady ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500 inline shrink-0" />
                            The MCQ test is LIVE! You can start your exam right now.
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-indigo-500 inline shrink-0" />
                            Round scheduled for:{" "}
                            <strong className="text-indigo-700 font-bold">
                              {new Date(app.assignment.scheduled_start_at).toLocaleString("en-US", {
                                dateStyle: "full",
                                timeStyle: "short",
                              })}
                            </strong>
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      {app.assignment?.id && app.assignment.isReady ? (
                        <Link href={`/candidate/assessments/${app.assignment.id}/exam`}>
                          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-sm flex items-center gap-1.5 animate-pulse">
                            Start MCQ Exam Now <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/candidate/assessments">
                          <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs h-9 px-4 rounded-lg">
                            {app.assignment?.scheduled_start_at ? "View Schedule Details" : "View Assessments"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {app.status === "coding" && (
                <div className="pt-2 border-t border-zinc-100">
                  <div className="p-4 rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50/40 to-purple-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          {app.assignment?.isReady ? (
                            <>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </>
                          ) : (
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
                          )}
                        </span>
                        <span className="text-xs font-bold text-pink-950">
                          Coding Interview Round (Built-in IDE)
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                        {!app.assignment?.scheduled_start_at ? (
                          "Notice: The Coding Interview round shall start soon. Date & time will be scheduled by recruiter shortly."
                        ) : app.assignment.isReady ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500 inline shrink-0" />
                            The Coding IDE workspace is LIVE! You may enter and begin coding now.
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-pink-500 inline shrink-0" />
                            Round scheduled for:{" "}
                            <strong className="text-pink-700 font-bold">
                              {new Date(app.assignment.scheduled_start_at).toLocaleString("en-US", {
                                dateStyle: "full",
                                timeStyle: "short",
                              })}
                            </strong>
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      {app.assignment?.id && app.assignment.isReady ? (
                        <Link href={`/candidate/coding/${app.assignment.id}/exam`}>
                          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-sm flex items-center gap-1.5 animate-pulse">
                            Enter Coding IDE Now <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/candidate/assessments">
                          <Button variant="outline" className="border-pink-200 text-pink-700 hover:bg-pink-50 font-semibold text-xs h-9 px-4 rounded-lg">
                            {app.assignment?.scheduled_start_at ? "View Schedule Details" : "View Assessments"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {app.status === "interview" && (
                <div className="pt-2 border-t border-zinc-100">
                  <div className="p-4 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50/40 to-emerald-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                        </span>
                        <span className="text-xs font-bold text-teal-950">
                          Technical Interview Round
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 font-medium">
                        Congratulations on passing the coding round! The technical interview date & time will be confirmed shortly.
                      </p>
                    </div>

                    <div>
                      <Link href="/candidate/interviews">
                        <Button className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-sm flex items-center gap-1.5">
                          View Interview Schedule <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Stepper */}
              {app.status !== "rejected" && app.status !== "withdrawn" ? (
                <div className="pt-4 border-t border-zinc-100 w-full">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold mb-2">
                    <span>APPLICATION PROGRESS STATE</span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      Score: {app.score || 2}/10 Points
                    </span>
                  </div>
                  <div className="relative flex items-center justify-between w-full mt-4 px-2">
                    {/* Progress Line */}
                    <div className="absolute left-6 right-6 top-3 h-0.5 bg-zinc-200 z-0" />
                    <div
                      className="absolute left-6 top-3 h-0.5 bg-blue-500 z-0 transition-all duration-300"
                      style={{
                        width: `${(getActiveStageIndex(app.status) / 4) * 88}%`,
                      }}
                    />

                    {/* Steps */}
                    {["Submitted", "Profile Screening", "MCQ Test", "Coding Round", "Interview"].map((label, index) => {
                      const isActive = index <= getActiveStageIndex(app.status);
                      return (
                        <div key={label} className="relative z-10 flex flex-col items-center w-16 text-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                              isActive
                                ? "bg-[#0071E3] border-[#0071E3] text-white shadow-sm"
                                : "bg-white border-zinc-200 text-zinc-450"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span
                            className={`text-[9px] mt-1.5 font-bold leading-tight ${
                              isActive ? "text-zinc-900" : "text-zinc-500"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-zinc-100 text-xs text-red-600 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  {app.status === "rejected" ? "Application Closed (Rejected)" : "Application Withdrawn"}
                </div>
              )}
            </div>
          );
        })}

        {applications.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-350 p-8 text-center text-zinc-700 italic text-sm">
            No active applications sent yet. Search active roles to get started.
          </div>
        )}
      </div>
    </div>
  );
}
