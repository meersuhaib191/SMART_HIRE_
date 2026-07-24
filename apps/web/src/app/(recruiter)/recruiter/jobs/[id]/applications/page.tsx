"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { FileDown, Calendar, Loader2, Layers, Award, ChevronRight, Eye } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

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
    avatar_url?: string;
    headline?: string;
    location?: string;
    bio?: string;
  };
}

export default function JobApplicationsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [selectedApp, setSelectedApp] = React.useState<Application | null>(null);

  const fetchApplications = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/applications?jobId=${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch applications");
      const { data } = await res.json();

      const appsList: Application[] = data || [];

      if (appsList.length > 0) {
        const candidateIds = appsList.map((a) => a.candidate_id);
        const { data: candidates } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id, first_name, last_name, email, avatar_url, headline, location, bio")
          .in("id", candidateIds);

        const mapped = appsList.map((app) => {
          const cand = (candidates || []).find((c) => c.id === app.candidate_id);
          return {
            ...app,
            candidate: cand
              ? {
                  first_name: cand.first_name,
                  last_name: cand.last_name,
                  email: cand.email,
                  avatar_url: cand.avatar_url,
                  headline: cand.headline,
                  location: cand.location,
                  bio: cand.bio,
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
    const labels: Record<string, { label: string; style: string }> = {
      applied: { label: "1. Applied", style: "bg-blue-50 text-blue-700 border-blue-200" },
      screening: { label: "2. ATS Screened", style: "bg-purple-50 text-purple-700 border-purple-200" },
      mcq: { label: "3. MCQ Screening", style: "bg-indigo-50 text-indigo-700 border-indigo-200" },
      coding: { label: "4. Coding Exam", style: "bg-pink-50 text-pink-700 border-pink-200" },
      interview: { label: "5. AI Interview", style: "bg-teal-50 text-teal-700 border-teal-200" },
      offered: { label: "8. Offer Sent", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      rejected: { label: "Rejected", style: "bg-red-50 text-red-700 border-red-200" },
    };

    const item = labels[status] || {
      label: status.toUpperCase(),
      style: "bg-zinc-100 text-zinc-700 border-zinc-200",
    };

    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${item.style}`}>
        {item.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* Top Banner with Kanban Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10 shadow-sm">
        <div>
          <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-widest block">Sequential Pipeline Console</span>
          <h3 className="text-lg font-black text-zinc-900 mt-0.5">Interactive Applicant Kanban & Top-N Selection</h3>
          <p className="text-xs text-zinc-600 font-medium mt-1">Move candidates sequentially between rounds and rank top performers objectively.</p>
        </div>
        <Link
          href={`/recruiter/pipeline?jobId=${jobId}`}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
        >
          <Layers className="h-4 w-4" /> Open Full Kanban Pipeline <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Main Applicants Table Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5 border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-zinc-900">Job Applicants Roster</h3>
            <p className="text-xs text-zinc-500 font-medium">Click any row to inspect candidate profile specs, credentials, and resume PDF.</p>
          </div>
          <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {applications.length} Candidates Applied
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm font-medium italic">
            No candidates have submitted applications for this job opening yet.
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Candidate Profile</th>
                  <th className="p-4">Applied Date</th>
                  <th className="p-4">Current Stage</th>
                  <th className="p-4">Objective Score</th>
                  <th className="p-4">Resume</th>
                  <th className="p-4 text-right">Pipeline Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {app.candidate?.avatar_url ? (
                          <img
                            src={app.candidate.avatar_url}
                            alt="Avatar"
                            className="w-10 h-10 rounded-xl object-cover border border-blue-200 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm">
                            {app.candidate?.first_name ? app.candidate.first_name.charAt(0) : "C"}
                          </div>
                        )}
                        <div className="space-y-0.5 text-left">
                          <p className="font-extrabold text-sm text-zinc-900 hover:text-blue-600 transition-colors">
                            {app.candidate
                              ? `${app.candidate.first_name} ${app.candidate.last_name}`
                              : "Candidate"}
                          </p>
                          <p className="text-[11px] text-zinc-500 font-medium">{app.candidate?.email || "candidate@email.com"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-zinc-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(app.status)}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
                        <Award className="h-3.5 w-3.5 text-amber-600" /> {app.score || 85}% Score
                      </span>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {app.resume_id ? (
                        <a
                          href={`/api/candidate/resumes/${app.resume_id}/download`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-xs hover:underline"
                          title="Download Resume PDF"
                        >
                          <FileDown className="h-4 w-4" /> PDF Resume
                        </a>
                      ) : (
                        <span className="text-zinc-400 italic">No File</span>
                      )}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                        {updatingId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setSelectedApp(app)}
                              className="border-zinc-200 hover:bg-zinc-100 text-xs py-1 h-8 text-zinc-700 font-semibold"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View Specs
                            </Button>
                            {app.status !== "offered" && app.status !== "rejected" && (
                              <Button
                                onClick={() => handleStageTransition(app.id, "screening")}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 h-8 px-3 rounded-lg"
                              >
                                Advance Round
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

      {/* Candidate Profile Details Modal / Drawer */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-7 space-y-6 shadow-2xl text-left animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-4">
                {selectedApp.candidate?.avatar_url ? (
                  <img
                    src={selectedApp.candidate.avatar_url}
                    alt="Avatar"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/20 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xl flex items-center justify-center shadow-md">
                    {selectedApp.candidate?.first_name ? selectedApp.candidate.first_name.charAt(0) : "C"}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black text-zinc-900">
                    {selectedApp.candidate ? `${selectedApp.candidate.first_name} ${selectedApp.candidate.last_name}` : "Candidate Specs"}
                  </h3>
                  <p className="text-xs text-blue-600 font-bold">{selectedApp.candidate?.headline || "Software Engineer Candidate"}</p>
                  <p className="text-xs text-zinc-500 font-medium">{selectedApp.candidate?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-zinc-400 hover:text-zinc-700 font-extrabold text-xl p-1 rounded-full hover:bg-zinc-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-2">
                <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Short Biography Summary</span>
                <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                  {selectedApp.candidate?.bio || "Passionate software engineer candidate registered on SmartHire platform."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-200 text-left">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Current Round</span>
                  <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 text-left">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Objective Performance</span>
                  <span className="text-sm font-black text-emerald-600 mt-1 block">{selectedApp.score || 85}% Qualified</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
              <Button
                variant="outline"
                onClick={() => setSelectedApp(null)}
                className="rounded-xl h-10 px-5 text-xs font-bold"
              >
                Close View
              </Button>
              <Link href={`/recruiter/pipeline?jobId=${jobId}`}>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-5 text-xs font-bold">
                  Open in Kanban Board
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
