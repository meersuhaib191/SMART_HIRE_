"use client";

import * as React from "react";
import Link from "next/link";
import { JobStatusBadge, JobStatus } from "./JobStatusBadge";
import { MapPin, Briefcase, DollarSign, Calendar, MoreHorizontal } from "lucide-react";

interface JobItem {
  id: string;
  title: string;
  category?: string;
  location?: string;
  type: "full-time" | "part-time" | "contract" | "internship";
  status: JobStatus;
  salary_min?: number;
  salary_max?: number;
  experience_level: string;
  created_at: string;
}

interface JobCardProps {
  job: JobItem;
  onActionClick?: (job: JobItem, action: "publish" | "archive" | "delete") => void;
}

const typeLabels: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "contract": "Contract",
  "internship": "Internship",
};

export function JobCard({ job, onActionClick }: JobCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatSalary = (min?: number, max?: number) => {
    if (!min) return "Undisclosed";
    if (!max) return `$${min.toLocaleString()}+`;
    return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  };

  const isClosed = job.status === "closed";

  return (
    <div className="group rounded-[16px] border border-[#D2D2D7] bg-white p-6 flex flex-col justify-between gap-5 transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] hover:border-[#AEAEB2]">
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider mb-1.5">
            {job.category || "General"}
          </p>
          <Link href={`/recruiter/jobs/${job.id}`}>
            <h3 className="text-[16px] font-semibold text-[#1D1D1F] leading-snug hover:text-[#0071E3] transition-colors line-clamp-2">
              {job.title}
            </h3>
          </Link>
        </div>

        {onActionClick && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#AEAEB2] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"
              aria-label="Job actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="sh-scale-in absolute right-0 mt-1.5 w-44 rounded-[14px] border border-[#D2D2D7] bg-white py-1.5 shadow-lg z-30 text-left">
                <Link
                  href={`/recruiter/jobs/${job.id}/edit`}
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center px-4 py-2 text-[13px] font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
                >
                  Edit Job
                </Link>
                {isClosed ? (
                  <button
                    onClick={() => { onActionClick(job, "publish"); setShowMenu(false); }}
                    className="flex w-full items-center px-4 py-2 text-[13px] font-semibold text-emerald-600 hover:bg-[#F5F5F7] transition-colors"
                  >
                    Re-Open Job
                  </button>
                ) : (
                  <button
                    onClick={() => { onActionClick(job, "archive"); setShowMenu(false); }}
                    className="flex w-full items-center px-4 py-2 text-[13px] font-semibold text-amber-600 hover:bg-[#F5F5F7] transition-colors"
                  >
                    Close Job
                  </button>
                )}
                <div className="my-1 border-t border-[#E8E8ED]" />
                <button
                  onClick={() => { onActionClick(job, "delete"); setShowMenu(false); }}
                  className="flex w-full items-center px-4 py-2 text-[13px] font-bold text-[#FF3B30] hover:bg-[#FFF0EE] transition-colors"
                >
                  Delete Job
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-2.5 text-[12px] text-[#6E6E73]">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-[#AEAEB2] shrink-0" />
          <span className="truncate">{job.location || "Remote"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-[#AEAEB2] shrink-0" />
          <span>{typeLabels[job.type] ?? job.type}</span>
        </div>
        <div className="flex items-center gap-2 col-span-2">
          <DollarSign className="h-3.5 w-3.5 text-[#AEAEB2] shrink-0" />
          <span className="font-medium text-[#1D1D1F]">
            {formatSalary(job.salary_min, job.salary_max)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#E8E8ED] pt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-[#AEAEB2]">
          <Calendar className="h-3.5 w-3.5" />
          <span>{new Date(job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <JobStatusBadge status={job.status} />
      </div>
    </div>
  );
}
