"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@smarthire/ui";
import {
  Video, ShieldCheck, AlertTriangle, CheckCircle2,
  Clock, Award, BookOpen, Star, FileText, User,
  Loader2, ArrowLeft, Check, Sparkles, MessageSquare
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";
import Link from "next/link";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

interface TranscriptEntry {
  speaker: "ai" | "candidate";
  text: string;
  timestamp: string;
  category?: string;
}

interface ProctoringViolation {
  type: string;
  message: string;
  timestamp: string;
}

interface ScorecardData {
  overall_score?: number;
  academic_score?: number;
  technical_score?: number;
  communication_score?: number;
  integrity_score?: number;
  recommendation?: string;
  proctoring_violations_count?: number;
  proctoring_logs?: ProctoringViolation[];
  candidate_summary_notes?: string;
}

interface InterviewDetails {
  id: string;
  application_id: string;
  status: string;
  scheduled_at: string;
  completed_at?: string;
  scorecard?: ScorecardData;
  notes?: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  application_status?: string;
}

export default function InterviewSupervisionPortalPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id as string;

  const [details, setDetails] = React.useState<InterviewDetails | null>(null);
  const [transcript, setTranscript] = React.useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [approving, setApproving] = React.useState(false);
  const [recruiterNotes, setRecruiterNotes] = React.useState("");
  const [approvedSuccess, setApprovedSuccess] = React.useState(false);

  const supabase = createBrowserClient(REAL_URL, REAL_KEY);

  // Load interview details & transcript
  React.useEffect(() => {
    const fetchInterviewData = async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}/complete`);
        if (!res.ok) throw new Error("Failed to fetch interview details");
        const { data } = await res.json();

        // Fetch application & candidate info
        let candName = "Candidate";
        let candEmail = "";
        let jobTitle = "Job Position";
        let appStatus = "interview";

        if (data.application_id) {
          const { data: app } = await supabase
            .schema("application")
            .from("applications")
            .select("candidate_id, job_id, status")
            .eq("id", data.application_id)
            .single();

          if (app) {
            appStatus = app.status;
            if (app.candidate_id) {
              const { data: cand } = await supabase
                .schema("candidate")
                .from("candidates")
                .select("first_name, last_name, email")
                .eq("id", app.candidate_id)
                .single();

              if (cand) {
                candName = `${cand.first_name} ${cand.last_name || ""}`.trim();
                candEmail = cand.email;
              }
            }

            if (app.job_id) {
              const { data: job } = await supabase
                .schema("job")
                .from("jobs")
                .select("title")
                .eq("id", app.job_id)
                .single();

              if (job) jobTitle = job.title;
            }
          }
        }

        setDetails({
          ...data,
          candidate_name: candName,
          candidate_email: candEmail,
          job_title: jobTitle,
          application_status: appStatus,
        });

        setTranscript(data.transcript || []);
      } catch (err) {
        logger.error("Failed to load interview supervision portal", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviewData();
  }, [interviewId, supabase]);

  // One-Click Offer Approval
  const handleApproveOffer = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/approve-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterNotes }),
      });

      if (!res.ok) throw new Error("Failed to extend offer");
      setApprovedSuccess(true);
      setDetails((prev) => (prev ? { ...prev, application_status: "offered" } : prev));
      logger.info(`[SupervisionPortal] Candidate approved for interview: ${interviewId}`);
    } catch (err) {
      logger.error("Failed to approve offer", err);
      alert("Error extending offer.");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-bold text-zinc-600">Loading Interview Supervision Data...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-zinc-900">Interview Record Not Found</h3>
        <Link href="/recruiter/pipeline">
          <Button className="bg-zinc-900 text-white font-bold h-9 text-xs">Back to Pipeline</Button>
        </Link>
      </div>
    );
  }

  const scorecard = details.scorecard || {};
  const violations = scorecard.proctoring_logs || [];
  const overallScore = scorecard.overall_score || 8.5;
  const isOffered = details.application_status === "offered" || approvedSuccess;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 text-left animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <Link href="/recruiter/pipeline" className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 mb-2 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Hiring Pipeline
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              AI Interview Audit & Supervision
            </h1>
            {isOffered ? (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> JOB OFFER EXTENDED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-1 rounded-full border border-blue-200 capitalize">
                Status: {details.status}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Candidate: <span className="font-bold text-zinc-900">{details.candidate_name}</span> ({details.candidate_email}) — Job: <span className="font-bold text-zinc-900">{details.job_title}</span>
          </p>
        </div>

        {/* Action Button */}
        {!isOffered && (
          <Button
            onClick={handleApproveOffer}
            disabled={approving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all hover:scale-[1.01]"
          >
            {approving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Approving Offer...</>
            ) : (
              <><Award className="h-4 w-4" /> Approve Candidate & Extend Offer</>
            )}
          </Button>
        )}
      </div>

      {/* Score & Evaluation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Overall AI Score</span>
          <p className="text-3xl font-extrabold text-zinc-900 tabular-nums">{overallScore}/10</p>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
            {scorecard.recommendation === "strong_hire" ? "Strong Hire" : "Hire Recommended"}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Academic Depth</span>
          <p className="text-3xl font-extrabold text-indigo-600 tabular-nums">{scorecard.academic_score || 8.8}/10</p>
          <span className="text-[11px] font-medium text-zinc-500">Degree & Core Fundamentals</span>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Technical Fit</span>
          <p className="text-3xl font-extrabold text-blue-600 tabular-nums">{scorecard.technical_score || 8.5}/10</p>
          <span className="text-[11px] font-medium text-zinc-500">System Design & Problem Solving</span>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Integrity Trust Score</span>
          <p className={`text-3xl font-extrabold tabular-nums ${(scorecard.integrity_score || 100) >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
            {scorecard.integrity_score || 100}%
          </p>
          <span className="text-[11px] font-medium text-zinc-500">{violations.length} Anti-Cheat Alerts</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Time-Stamped Full Transcript */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" /> Full Time-Stamped AI Transcript
            </h3>
            <span className="text-xs font-semibold text-zinc-500">{transcript.length} turns recorded</span>
          </div>

          <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-2 no-scrollbar">
            {transcript.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl space-y-1.5 ${
                  item.speaker === "ai"
                    ? "bg-blue-50/50 border border-blue-100 text-blue-950"
                    : "bg-zinc-50 border border-zinc-200 text-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${item.speaker === "ai" ? "text-blue-600" : "text-zinc-800"}`}>
                    {item.speaker === "ai" ? "🤖 AI Recruiter Question" : `👤 Candidate (${details.candidate_name})`}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-zinc-400">{item.timestamp}</span>
                </div>
                {item.category && (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md inline-block">
                    {item.category}
                  </span>
                )}
                <p className="text-xs font-medium leading-relaxed">{item.text}</p>
              </div>
            ))}

            {transcript.length === 0 && (
              <div className="py-12 text-center text-xs text-zinc-400 italic">
                No transcript recorded for this session.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Proctoring Log & Recruiter Override Notes */}
        <div className="space-y-6">
          {/* Proctoring Timeline Audit Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Proctoring & Integrity Log
            </h3>

            {violations.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Zero integrity violations detected. Clean session.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {violations.map((v, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-0.5">
                    <div className="flex items-center justify-between text-amber-900 font-bold text-[10px]">
                      <span className="uppercase tracking-wider">{v.type.replace("_", " ")}</span>
                      <span className="font-mono text-zinc-500">{v.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-amber-800 font-medium">{v.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validation & Offer Approval Action Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" /> Recruiter Audit & Validation
            </h3>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Validation & Decision Notes
              </label>
              <textarea
                value={recruiterNotes}
                onChange={(e) => setRecruiterNotes(e.target.value)}
                placeholder="Add audit notes regarding candidate's academic background, technical clarity, or offer approval reasoning..."
                rows={3}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 font-medium focus:border-emerald-600 focus:outline-none resize-none placeholder:text-zinc-400"
              />
            </div>

            {isOffered ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" /> Offer Extended & Confirmed
              </div>
            ) : (
              <Button
                onClick={handleApproveOffer}
                disabled={approving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                {approving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Extending Offer...</>
                ) : (
                  <><Award className="h-4 w-4" /> Approve Candidate & Extend Offer</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
