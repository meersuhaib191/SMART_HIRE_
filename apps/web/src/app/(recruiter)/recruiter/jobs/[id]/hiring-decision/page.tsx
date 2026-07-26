"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { ArrowLeft, UserCheck, ChevronRight, BarChart3, CheckCircle2, PauseCircle, XCircle, FileText, Sparkles, Loader2 } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface HiringDecisionCandidate {
  id: string; // application_id
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  screening_score: number | null;
  mcq_score: number | null;
  coding_score: number | null;
  interview_avg_score: number | null;
  interview_recommendation: string | null;
  decision_status: string | null;
  created_at: string;
}

export default function HiringDecisionPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = React.useState<string>("Job Position");
  const [candidates, setCandidates] = React.useState<HiringDecisionCandidate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);

  // Rejection Modal State
  const [rejectCandidate, setRejectCandidate] = React.useState<HiringDecisionCandidate | null>(null);
  const [rejectionCategory, setRejectionCategory] = React.useState<string>("Interview Evaluation");
  const [internalNotes, setInternalNotes] = React.useState<string>("");

  const fetchHiringDecisionData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Job title
      const { data: job } = await supabase
        .schema("job")
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .maybeSingle();

      if (job?.title) setJobTitle(job.title);

      // 2. Fetch Applications in hiring_decision stage or completed rounds
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select(`
          id,
          candidate_id,
          status,
          screening_score,
          mcq_score,
          coding_score,
          interview_avg_score,
          interview_recommendation,
          decision_status,
          created_at
        `)
        .eq("job_id", jobId)
        .is("deleted_at", null);

      const appList = apps || [];

      if (appList.length > 0) {
        const candidateIds = appList.map((a) => a.candidate_id);
        const { data: cands } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id, first_name, last_name, email")
          .in("id", candidateIds);

        const candMap = new Map<string, any>();
        (cands || []).forEach((c) => candMap.set(c.id, c));

        const mapped: HiringDecisionCandidate[] = appList.map((app) => {
          const c = candMap.get(app.candidate_id);
          return {
            id: app.id,
            candidate_id: app.candidate_id,
            first_name: c?.first_name || "Applicant",
            last_name: c?.last_name || "",
            email: c?.email || "No email",
            status: app.status,
            screening_score: app.screening_score,
            mcq_score: app.mcq_score,
            coding_score: app.coding_score,
            interview_avg_score: app.interview_avg_score,
            interview_recommendation: app.interview_recommendation,
            decision_status: app.decision_status || (app.status === "hiring_decision" ? "pending" : app.status),
            created_at: app.created_at,
          };
        });

        // Filter candidates in hiring_decision stage
        const filtered = mapped.filter((m) =>
          ["hiring_decision", "approved_for_offer", "on_hold", "offer", "offer_sent", "hired"].includes(m.status)
        );
        setCandidates(filtered);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      logger.error("Failed to load Hiring Decision page", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchHiringDecisionData();
  }, [fetchHiringDecisionData]);

  // Metrics
  const totalCount = candidates.length;
  const awaitingCount = candidates.filter((c) => c.status === "hiring_decision" && c.decision_status !== "approved_for_offer" && c.decision_status !== "on_hold").length;
  const approvedCount = candidates.filter((c) => c.decision_status === "approved_for_offer" || ["offer", "offer_sent", "hired"].includes(c.status)).length;
  const onHoldCount = candidates.filter((c) => c.decision_status === "on_hold").length;

  const handleDecision = async (applicationId: string, action: "approve" | "hold" | "reject") => {
    setSubmittingId(applicationId);
    try {
      const res = await fetch("/api/hiring-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          action,
          rejectionCategory: action === "reject" ? rejectionCategory : undefined,
          internalNotes: action === "reject" ? internalNotes : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Decision action failed");

      fetchHiringDecisionData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error: ${msg}`);
    } finally {
      setSubmittingId(null);
      setRejectCandidate(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 sm:px-6 text-left sh-animate-in">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
            <Link href="/recruiter/pipeline" className="hover:text-blue-600">Jobs</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-700 font-bold">{jobTitle}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-violet-600 font-bold">Hiring Decision Panel</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-violet-600" />
            Hiring Decision Panel
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/recruiter/pipeline?jobId=${jobId}`)}
            className="text-xs font-bold gap-1.5 border-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Pipeline
          </Button>
          <Button
            onClick={() => router.push(`/recruiter/jobs/${jobId}/offers`)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Manage Offers →
          </Button>
        </div>
      </div>

      {/* Metrics Toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Candidates</span>
          <span className="text-2xl font-black text-zinc-900">{totalCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Awaiting Decision</span>
          <span className="text-2xl font-black text-amber-600">{awaitingCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Approved for Offer</span>
          <span className="text-2xl font-black text-emerald-600">{approvedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider block">On Hold</span>
          <span className="text-2xl font-black text-violet-600">{onHoldCount}</span>
        </div>
      </div>

      {/* Candidates Consolidated Evidence & Decision Roster */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
            Consolidated Multi-Round Evidence & Decision Panel
          </h3>
          <span className="text-xs font-medium text-zinc-500">{candidates.length} Candidates</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-medium">Loading hiring decision evidence...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">
            No candidates currently in Hiring Decision stage.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">ATS Match</th>
                  <th className="p-3.5">MCQ Score</th>
                  <th className="p-3.5">Coding Score</th>
                  <th className="p-3.5">AI Interview</th>
                  <th className="p-3.5">Final Interview Score</th>
                  <th className="p-3.5">Recruiter Rec.</th>
                  <th className="p-3.5 text-right">Decision Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {candidates.map((c) => {
                  const isApproved = c.decision_status === "approved_for_offer" || ["offer", "offer_sent", "hired"].includes(c.status);
                  const isHold = c.decision_status === "on_hold";
                  const isSubmitting = submittingId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{c.first_name} {c.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-extrabold text-blue-600">
                        {c.screening_score != null ? `${c.screening_score}%` : "—"}
                      </td>
                      <td className="p-3.5 font-extrabold text-emerald-600">
                        {c.mcq_score != null ? `${c.mcq_score}%` : "—"}
                      </td>
                      <td className="p-3.5 font-extrabold text-violet-600">
                        {c.coding_score != null ? `${c.coding_score}%` : "—"}
                      </td>
                      <td className="p-3.5 font-extrabold text-indigo-600">
                        {c.interview_avg_score != null ? `${c.interview_avg_score}%` : "—"}
                      </td>
                      <td className="p-3.5 font-black text-emerald-600 text-sm">
                        {c.interview_avg_score != null ? `${c.interview_avg_score}%` : "—"}
                      </td>
                      <td className="p-3.5 font-extrabold uppercase text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full border ${
                          c.interview_recommendation === "strong_hire" || c.interview_recommendation === "hire"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.interview_recommendation === "further_review"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {c.interview_recommendation ? c.interview_recommendation.replace("_", " ") : "Hire"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approved for Offer
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              disabled={isSubmitting}
                              onClick={() => handleDecision(c.id, "approve")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold h-7.5 px-3 shadow-xs"
                            >
                              Approve for Offer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSubmitting}
                              onClick={() => handleDecision(c.id, "hold")}
                              className="text-[11px] font-bold h-7.5 px-2.5 border-zinc-300 text-zinc-700"
                            >
                              Hold
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSubmitting}
                              onClick={() => setRejectCandidate(c)}
                              className="text-[11px] font-bold h-7.5 px-2.5 border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 text-left space-y-4">
            <h3 className="text-base font-black text-zinc-900">
              Reject Application for {rejectCandidate.first_name} {rejectCandidate.last_name}
            </h3>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                Reason Category <span className="text-red-500">*</span>
              </label>
              <select
                value={rejectionCategory}
                onChange={(e) => setRejectionCategory(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900"
              >
                <option value="Qualifications">Qualifications</option>
                <option value="Technical Assessment">Technical Assessment</option>
                <option value="Interview Evaluation">Interview Evaluation</option>
                <option value="Experience Alignment">Experience Alignment</option>
                <option value="Position Filled">Position Filled</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                Optional Internal Note
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal feedback for recruiter record..."
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRejectCandidate(null)} className="text-xs font-bold">
                Cancel
              </Button>
              <Button
                onClick={() => handleDecision(rejectCandidate.id, "reject")}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
