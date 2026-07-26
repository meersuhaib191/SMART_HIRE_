"use client";

import * as React from "react";
import Link from "next/link";
import { JobStatusBadge, JobStatus } from "./JobStatusBadge";
import { MapPin, Calendar, MoreHorizontal, ChevronRight } from "lucide-react";

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

interface JobTableProps {
  jobs: JobItem[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onActionClick?: (job: JobItem, action: "publish" | "archive" | "delete") => void;
}

const typeLabels: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};

function formatSalary(min?: number, max?: number) {
  if (!min) return "Undisclosed";
  if (!max) return `$${min.toLocaleString()}+`;
  return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
}

export function JobTable({
  jobs,
  selectedIds,
  onSelectChange,
  onActionClick,
}: JobTableProps) {
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);

  const toggleAll = () => {
    onSelectChange(selectedIds.length === jobs.length ? [] : jobs.map((j) => j.id));
  };
  const toggleOne = (id: string) => {
    onSelectChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="rounded-[16px] border border-[#D2D2D7] bg-white overflow-hidden transition-all duration-200 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.08)] hover:border-[#AEAEB2]">
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Head */}
          <thead>
            <tr className="border-b border-[#E8E8ED] bg-[#F5F5F7]">
              <th className="px-5 py-3.5 w-12">
                <input
                  type="checkbox"
                  checked={jobs.length > 0 && selectedIds.length === jobs.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded-[4px] border-[#D2D2D7] text-[#0071E3] accent-[#0071E3]"
                />
              </th>
              {["Job Title", "Location", "Type", "Salary", "Status", "Posted", ""].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3.5 text-left text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-[#E8E8ED]">
            {jobs.map((job) => {
              const isSelected = selectedIds.includes(job.id);
              const isMenuOpen = activeMenuId === job.id;
              const isClosed = job.status === "closed";

              return (
                <tr
                  key={job.id}
                  className={`transition-colors duration-100 ${
                    isSelected ? "bg-[#EAF3FF]" : "hover:bg-[#F5F5F7]"
                  }`}
                >
                  <td className="px-5 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(job.id)}
                      className="h-4 w-4 rounded-[4px] border-[#D2D2D7] text-[#0071E3] accent-[#0071E3]"
                    />
                  </td>

                  {/* Title */}
                  <td className="px-4 py-4 min-w-[200px]">
                    <div>
                      <Link
                        href={`/recruiter/jobs/${job.id}`}
                        className="text-[13px] font-semibold text-[#1D1D1F] hover:text-[#0071E3] transition-colors line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      <p className="text-[11px] text-[#AEAEB2] mt-0.5">
                        {job.category || "Uncategorized"}
                      </p>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73]">
                      <MapPin className="h-3.5 w-3.5 text-[#AEAEB2] shrink-0" />
                      {job.location || "Remote"}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-4">
                    <span className="text-[12px] text-[#6E6E73]">
                      {typeLabels[job.type] ?? job.type}
                    </span>
                  </td>

                  {/* Salary */}
                  <td className="px-4 py-4">
                    <span className="text-[12px] font-medium text-[#1D1D1F] tabular-nums">
                      {formatSalary(job.salary_min, job.salary_max)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <JobStatusBadge status={job.status} />
                  </td>

                  {/* Date */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-[12px] text-[#6E6E73]">
                      <Calendar className="h-3.5 w-3.5 text-[#AEAEB2] shrink-0" />
                      {new Date(job.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/recruiter/pipeline?jobId=${job.id}`}
                        className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer shrink-0"
                        title="Open Kanban Board"
                      >
                        Kanban Pipeline
                      </Link>

                      <Link
                        href={`/recruiter/jobs/${job.id}/applications`}
                        className="inline-flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs px-3 py-1.5 rounded-lg border border-zinc-200 transition-all cursor-pointer shrink-0"
                        title="View Candidates Roster"
                      >
                        Applicants
                      </Link>

                      <Link
                        href={`/recruiter/jobs/${job.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"
                        title="View Overview Details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>

                      {onActionClick && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuId(isMenuOpen ? null : job.id)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#AEAEB2] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {isMenuOpen && (
                            <div className="sh-scale-in absolute right-0 mt-1.5 w-44 rounded-[14px] border border-[#D2D2D7] bg-white py-1.5 shadow-lg z-30 text-left">
                              <Link
                                href={`/recruiter/jobs/${job.id}/edit`}
                                onClick={() => setActiveMenuId(null)}
                                className="flex w-full px-4 py-2 text-[13px] text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors font-medium"
                              >
                                Edit Job
                              </Link>
                              {isClosed ? (
                                <button
                                  onClick={() => {
                                    onActionClick(job, "publish");
                                    setActiveMenuId(null);
                                  }}
                                  className="flex w-full px-4 py-2 text-[13px] text-emerald-600 hover:bg-[#F5F5F7] transition-colors font-medium"
                                >
                                  Re-Open Job
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    onActionClick(job, "archive");
                                    setActiveMenuId(null);
                                  }}
                                  className="flex w-full px-4 py-2 text-[13px] text-amber-600 hover:bg-[#F5F5F7] transition-colors font-medium"
                                >
                                  Close Job
                                </button>
                              )}
                              <div className="my-1 border-t border-[#E8E8ED]" />
                              <button
                                onClick={() => {
                                  onActionClick(job, "delete");
                                  setActiveMenuId(null);
                                }}
                                className="flex w-full px-4 py-2 text-[13px] text-[#FF3B30] hover:bg-[#FFF0EE] transition-colors font-semibold"
                              >
                                Delete Job
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {jobs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-16 text-center text-[13px] text-[#AEAEB2]"
                >
                  No jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
