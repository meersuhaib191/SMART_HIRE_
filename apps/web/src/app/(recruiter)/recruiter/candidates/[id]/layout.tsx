"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { ArrowLeft, MapPin, Mail, Phone, Calendar } from "lucide-react";
import { logger } from "@smarthire/logger";
import { SkeletonPageHeader, SkeletonCard } from "@/components/shared/Skeleton";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase clients for schemas
const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });
const appClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "application" } });

interface CandidateDetails {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  created_at: string;
}

export default function CandidateDetailsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const candidateId = params.id as string;

  const [candidate, setCandidate] = React.useState<CandidateDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [appliedJob, setAppliedJob] = React.useState<string | null>(null);
  const [currentStage, setCurrentStage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadCandidateDetails = async () => {
      try {
        // Query candidate profile
        const { data: cand, error } = await candClient
          .from("candidates")
          .select("*")
          .eq("id", candidateId)
          .is("deleted_at", null)
          .maybeSingle();

        if (error) throw error;
        setCandidate(cand);

        if (cand) {
          // Fetch application status
          const { data: apps } = await appClient
            .from("applications")
            .select("status, job_id")
            .eq("candidate_id", cand.id)
            .is("deleted_at", null)
            .maybeSingle();

          if (apps) {
            setCurrentStage(apps.status);
            // Fetch job title
            const { data: job } = await appClient
              .from("jobs")
              .select("title")
              .eq("id", apps.job_id)
              .maybeSingle();
            if (job) setAppliedJob(job.title);
          }
        }
      } catch (err) {
        logger.error("Failed to load candidate layout details", err);
      } finally {
        setLoading(false);
      }
    };
    loadCandidateDetails();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto py-6 sh-animate-in">
        <SkeletonPageHeader />
        <SkeletonCard />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto bg-white rounded-[16px] border border-[#D2D2D7] p-8 mt-12 sh-scale-in">
        <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Candidate profile not found</h3>
        <Link href="/recruiter/candidates" className="inline-flex text-[13px] font-semibold text-[#0071E3] hover:underline">
          Return to Candidate Directory
        </Link>
      </div>
    );
  }

  const getInitials = (first: string, last: string) => {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  const tabs = [
    { name: "Overview", href: `/recruiter/candidates/${candidateId}` },
    { name: "Resume & Portfolio", href: `/recruiter/candidates/${candidateId}/resume` },
    { name: "Assessments", href: `/recruiter/candidates/${candidateId}/assessments` },
    { name: "Interviews", href: `/recruiter/candidates/${candidateId}/interviews` },
    { name: "Timeline logs", href: `/recruiter/candidates/${candidateId}/timeline` },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto sh-animate-in">
      {/* Back Link */}
      <div className="text-left">
        <Link
          href="/recruiter/candidates"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Candidate Directory
        </Link>
      </div>

      {/* Profile Header Banner */}
      <div className="rounded-[16px] border border-[#D2D2D7] bg-white p-6 flex flex-col md:flex-row items-start justify-between gap-6 text-left transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)]">
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-14 w-14 rounded-full bg-[#EAF3FF] text-[#0071E3] flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
            {getInitials(candidate.first_name, candidate.last_name)}
          </div>

          <div className="space-y-2.5 min-w-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                {candidate.first_name} {candidate.last_name}
              </h1>
              <p className="text-[12px] text-[#6E6E73] font-medium mt-0.5 truncate">
                {candidate.headline || "Candidate Profile"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#6E6E73] font-medium">
              {candidate.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#AEAEB2] shrink-0" />
                  <span>{candidate.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-[#AEAEB2] shrink-0" />
                <span>{candidate.email}</span>
              </div>
              {candidate.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-[#AEAEB2] shrink-0" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#AEAEB2] shrink-0" />
                <span className="tabular-nums">Applied {new Date(candidate.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Application details stats */}
        {appliedJob && (
          <div className="rounded-[16px] bg-[#F5F5F7] p-4 border border-[#D2D2D7] text-xs space-y-2.5 min-w-[220px] shrink-0">
            <div>
              <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Applied Opening
              </span>
              <p className="font-semibold text-[#1D1D1F] truncate mt-0.5">{appliedJob}</p>
            </div>
            <div className="flex justify-between items-center mt-2 pt-2.5 border-t border-[#D2D2D7]">
              <span className="text-[#6E6E73] font-medium">Pipeline Stage</span>
              <span className="inline-flex items-center rounded-full bg-[#EAF3FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#0071E3] capitalize border border-[#C5DCFF]">
                {currentStage}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-[#E8E8ED] overflow-x-auto max-w-full no-scrollbar">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`px-5 py-3 text-[13px] font-semibold border-b-2 shrink-0 transition-colors ${
                isActive
                  ? "border-[#0071E3] text-[#0071E3]"
                  : "border-transparent text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Children Panels */}
      <div>{children}</div>
    </div>
  );
}
