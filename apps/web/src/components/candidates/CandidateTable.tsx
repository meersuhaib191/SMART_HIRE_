"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, MapPin, Calendar, ExternalLink, User } from "lucide-react";
import { CandidateItem } from "./CandidateCard";

interface CandidateTableProps {
  candidates: CandidateItem[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  stagesMap?: Record<string, string>;
  jobsMap?: Record<string, string>;
  onViewCandidate?: (candidate: CandidateItem) => void;
}

export function CandidateTable({
  candidates,
  selectedIds,
  onSelectChange,
  stagesMap = {},
  jobsMap = {},
  onViewCandidate,
}: CandidateTableProps) {
  const toggleSelectAll = () => {
    if (selectedIds.length === candidates.length) {
      onSelectChange([]);
    } else {
      onSelectChange(candidates.map((c) => c.id));
    }
  };

  const toggleSelectOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  const getInitials = (first: string, last: string) => {
    return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "U";
  };

  const getStageBadgeStyle = (stage: string) => {
    const s = stage.toLowerCase();
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
    <div className="w-full overflow-x-auto rounded-[16px] border border-zinc-200 bg-white overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 font-semibold uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3.5 w-12">
              <input
                type="checkbox"
                checked={candidates.length > 0 && selectedIds.length === candidates.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </th>
            <th className="px-4 py-3.5 whitespace-nowrap">Candidate Name</th>
            <th className="px-4 py-3.5 whitespace-nowrap">Location</th>
            <th className="px-4 py-3.5 whitespace-nowrap">Job Applied</th>
            <th className="px-4 py-3.5 whitespace-nowrap">Current Stage</th>
            <th className="px-4 py-3.5 whitespace-nowrap">Applied Date</th>
            <th className="px-4 py-3.5 w-24 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 text-zinc-900">
          {candidates.map((candidate) => {
            const isSelected = selectedIds.includes(candidate.id);
            const appliedJob = jobsMap[candidate.id] || "No Active Application";
            const currentStage = stagesMap[candidate.id] || "applied";

            return (
              <tr
                key={candidate.id}
                onClick={() => onViewCandidate && onViewCandidate(candidate)}
                className={`transition-colors duration-150 cursor-pointer ${
                  isSelected ? "bg-blue-50/60" : "hover:bg-blue-50/30"
                }`}
              >
                <td className="px-5 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleSelectOne(e as unknown as React.MouseEvent, candidate.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-4 min-w-[220px]">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-extrabold shadow-sm shrink-0">
                      {getInitials(candidate.first_name, candidate.last_name)}
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-[13px] font-bold text-zinc-900 hover:text-blue-600 transition-colors block">
                        {candidate.first_name} {candidate.last_name}
                      </span>
                      <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                        <Mail className="h-3 w-3 text-zinc-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{candidate.email}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {candidate.location ? (
                    <div className="flex items-center gap-1.5 text-left">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="text-[12px]">{candidate.location}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic">Not set</span>
                  )}
                </td>
                <td className="px-4 py-4 text-left">
                  <span className={`text-[12px] font-bold ${appliedJob === "No Active Application" ? "text-zinc-400 italic font-normal" : "text-zinc-800"}`}>
                    {appliedJob}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${getStageBadgeStyle(currentStage)}`}>
                    {currentStage.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-500">
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="tabular-nums">
                      {new Date(candidate.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 w-24 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onViewCandidate && onViewCandidate(candidate)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                      title="Quick Preview Profile"
                    >
                      <User className="h-3.5 w-3.5" /> View
                    </button>
                    <Link
                      href={`/recruiter/candidates/${candidate.id}`}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      title="Open Dedicated Full Page"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}

          {candidates.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-16 text-center text-xs text-zinc-400 italic">
                No candidates found matching your filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
