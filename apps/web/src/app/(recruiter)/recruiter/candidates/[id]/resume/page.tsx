"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { Button } from "@smarthire/ui";
import { FileText, FileDown, Loader2, Sparkles } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });

interface ResumeDetails {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

export default function CandidateResumePage() {
  const params = useParams();
  const candidateId = params.id as string;

  const [resumes, setResumes] = React.useState<ResumeDetails[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchResumes = async () => {
      try {
        const { data, error } = await candClient
          .from("resumes")
          .select("id, file_name, file_url, created_at")
          .eq("candidate_id", candidateId)
          .is("deleted_at", null);

        if (error) throw error;
        setResumes(data || []);
      } catch (err) {
        logger.error("Failed to load candidate resumes metadata", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResumes();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  const activeResume = resumes[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-in fade-in duration-200">
      {/* Left Column: PDF Resume view panel */}
      <div className="lg:col-span-8 space-y-6">
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6 flex flex-col items-center justify-center min-h-[400px]">
          {activeResume ? (
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-200">{activeResume.file_name}</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Uploaded {new Date(activeResume.created_at).toLocaleDateString()}
                </p>
              </div>
              <a href={`/api/candidate/resumes/${activeResume.id}/download`} className="block">
                <Button variant="primary" className="bg-blue-600 text-white hover:bg-blue-500 flex items-center gap-1.5 h-10 px-6 mx-auto">
                  <FileDown className="h-4.5 w-4.5" /> Download PDF File
                </Button>
              </a>
            </div>
          ) : (
            <div className="text-center text-zinc-550 text-xs italic space-y-2">
              <p>No active resume has been uploaded by the candidate.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: AI resume summary / metadata */}
      <div className="lg:col-span-4 space-y-6">
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150 flex items-center gap-1.5 border-b border-zinc-850 pb-2">
            <Sparkles className="h-4.5 w-4.5 text-blue-500" /> AI Resume Summary
          </h3>
          <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
            Candidate presents a strong background in software engineering, demonstrating expert-level knowledge of React and frontend development patterns. Has 3+ years experience building SaaS applications and optimizing relational SQL schemas.
          </p>
          <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-900 space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Key Keywords</span>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[9px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded font-mono">React</span>
              <span className="text-[9px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded font-mono">TypeScript</span>
              <span className="text-[9px] bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded font-mono">SQL</span>
            </div>
          </div>
        </div>

        {/* Version history */}
        <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-[#09090c]/50 p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-150 border-b border-zinc-850 pb-2">
            Version History ({resumes.length})
          </h3>
          <div className="space-y-3.5">
            {resumes.map((res) => (
              <div key={res.id} className="flex justify-between items-center text-xs">
                <div>
                  <p className="font-semibold text-zinc-300 truncate max-w-[150px]">{res.file_name}</p>
                  <p className="text-[10px] text-zinc-550">{new Date(res.created_at).toLocaleDateString()}</p>
                </div>
                <a
                  href={`/api/candidate/resumes/${res.id}/download`}
                  className="text-blue-500 hover:text-blue-450 hover:underline font-semibold"
                >
                  Download
                </a>
              </div>
            ))}

            {resumes.length === 0 && (
              <div className="text-xs text-zinc-500 italic">No historical versions.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
