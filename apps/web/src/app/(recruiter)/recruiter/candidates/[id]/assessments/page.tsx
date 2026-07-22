"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { Loader2, ClipboardCheck, CheckCircle2, XCircle } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const assessClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "assessment" } });

interface AttemptDetails {
  id: string;
  assessment_id: string;
  score?: number;
  passed?: boolean;
  started_at: string;
  completed_at?: string;
  assessment?: {
    title: string;
  };
}

export default function CandidateAssessmentsPage() {
  const params = useParams();
  const candidateId = params.id as string;

  const [attempts, setAttempts] = React.useState<AttemptDetails[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAttempts = async () => {
      try {
        // Query attempts directly from assessment schema
        const { data, error } = await assessClient
          .from("attempts")
          .select("id, score, passed, started_at, completed_at, assessment_id")
          .eq("candidate_id", candidateId);

        if (error) throw error;

        // Fetch template details for each attempt
        const attemptsList = data || [];
        if (attemptsList.length > 0) {
          const { data: templates } = await assessClient
            .from("assessments")
            .select("id, title");

          const mapped = attemptsList.map((att) => {
            const template = (templates || []).find((t) => t.id === att.assessment_id);
            return {
              ...att,
              assessment: template ? { title: template.title } : { title: "Technical Evaluation Exam" },
            };
          });
          setAttempts(mapped);
        } else {
          setAttempts([]);
        }
      } catch (err) {
        logger.error("Failed to load candidate assessments", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, [candidateId]);

  const getPassingBadge = (passed?: boolean) => {
    if (passed === undefined || passed === null) {
      return <span className="text-zinc-500 font-semibold">Pending Grade</span>;
    }
    return passed ? (
      <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
        <CheckCircle2 className="h-4 w-4" /> Passed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
        <XCircle className="h-4 w-4" /> Failed
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
      <div className="flex justify-between items-center mb-6 border-b border-zinc-850 pb-3">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-150 flex items-center gap-1.5">
          <ClipboardCheck className="h-5 w-5 text-zinc-450" /> Assigned screening assessments
        </h3>
        <span className="text-xs text-zinc-550 font-mono">
          Total Attempts: {attempts.length}
        </span>
      </div>

      {attempts.length === 0 ? (
        <div className="text-center py-12 text-zinc-555 text-sm">
          No screening exams or assessment templates have been assigned to this candidate.
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/30">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-zinc-150 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950/60 text-zinc-550 dark:text-zinc-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4">Assessment Title</th>
                <th className="p-4">Assigned Date</th>
                <th className="p-4">Completion Date</th>
                <th className="p-4">Obtained Score</th>
                <th className="p-4">Passing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850 text-zinc-700 dark:text-zinc-300">
              {attempts.map((att) => (
                <tr key={att.id} className="hover:bg-zinc-900/35 transition-colors">
                  <td className="p-4 font-bold text-zinc-200">
                    {att.assessment?.title || "Technical Screening"}
                  </td>
                  <td className="p-4 text-zinc-500">
                    {new Date(att.started_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-zinc-500">
                    {att.completed_at ? new Date(att.completed_at).toLocaleDateString() : "In Progress"}
                  </td>
                  <td className="p-4 font-mono font-bold text-zinc-300">
                    {att.score !== undefined && att.score !== null ? `${att.score}%` : "--"}
                  </td>
                  <td className="p-4">
                    {getPassingBadge(att.passed)}
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
