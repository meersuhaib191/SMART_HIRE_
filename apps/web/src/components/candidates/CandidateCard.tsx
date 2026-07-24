"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, MapPin, Briefcase, Calendar, User, ExternalLink } from "lucide-react";

export interface CandidateItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  tags?: string[];
  created_at: string;
}

interface CandidateCardProps {
  candidate: CandidateItem;
  jobApplied?: string;
  stage?: string;
  onViewCandidate?: (candidate: CandidateItem) => void;
}

export function CandidateCard({ candidate, jobApplied, stage, onViewCandidate }: CandidateCardProps) {
  const getInitials = (first: string, last: string) => {
    return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "U";
  };

  const getStageBadgeStyle = (stg?: string) => {
    if (!stg) return "bg-zinc-100 text-zinc-700 border-zinc-200";
    const s = stg.toLowerCase();
    if (s.includes("offer") || s.includes("hired") || s.includes("joined")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (s.includes("interview") || s.includes("zoom")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (s.includes("coding") || s.includes("mcq")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (s.includes("rejected")) {
      return "bg-red-50 text-red-700 border-red-200";
    }
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
  };

  return (
    <div
      onClick={() => onViewCandidate && onViewCandidate(candidate)}
      className="group rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-blue-300 relative text-left cursor-pointer"
    >
      <div>
        {/* Header with Avatar & Name */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
              {getInitials(candidate.first_name, candidate.last_name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                {candidate.first_name} {candidate.last_name}
              </h3>
              <p className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                {candidate.headline || "Applicant"}
              </p>
            </div>
          </div>
          {stage && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize shrink-0 ${getStageBadgeStyle(stage)}`}>
              {stage.replace("_", " ")}
            </span>
          )}
        </div>

        {/* Technical Specs */}
        <div className="grid grid-cols-1 gap-2 my-4 text-xs text-zinc-600 border-t border-b border-zinc-100 py-3">
          {candidate.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">{candidate.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{candidate.email}</span>
          </div>
          {jobApplied && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="font-bold text-zinc-800 truncate">{jobApplied}</span>
            </div>
          )}
        </div>

        {/* Tags Row */}
        {candidate.tags && candidate.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {candidate.tags.slice(0, 3).map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider"
              >
                {t}
              </span>
            ))}
            {candidate.tags.length > 3 && (
              <span className="text-[10px] text-zinc-500 font-bold self-center">
                +{candidate.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Bottom Row */}
      <div className="flex justify-between items-center pt-4 mt-3 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Calendar className="h-3.5 w-3.5" />
          <span>Applied {new Date(candidate.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onViewCandidate && onViewCandidate(candidate)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <User className="h-3.5 w-3.5" /> Profile
          </button>
          <Link
            href={`/recruiter/candidates/${candidate.id}`}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
