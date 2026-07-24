"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Layers,
  Calendar,
  Loader2,
  ArrowRight,
  Briefcase,
  Sparkles,
  DollarSign,
  Filter,
  X
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  experience_level?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  created_at: string;
  company_name?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Software Engineering": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Artificial Intelligence": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Cybersecurity": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Cloud Engineering": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "Product Design": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Data Engineering": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Quality Assurance": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Product Management": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  "Marketing": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  "Finance Analytics": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "Sales & BD": { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  "Human Resources": { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200" },
  "Enterprise IT": { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
};

export default function CandidateJobsSearchPage() {
  const [jobs, setJobs] = React.useState<JobListing[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedType, setSelectedType] = React.useState<string>("ALL");
  const [selectedLevel, setSelectedLevel] = React.useState<string>("ALL");

  React.useEffect(() => {
    const fetchJobs = async () => {
      try {
        const [jobsRes, companiesRes] = await Promise.all([
          supabase
            .schema("job")
            .from("jobs")
            .select("id, company_id, title, category, location, type, experience_level, salary_min, salary_max, description, created_at")
            .eq("status", "published")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .schema("organization")
            .from("companies")
            .select("id, name")
        ]);

        if (jobsRes.error) throw jobsRes.error;

        const companyMap = new Map<string, string>();
        (companiesRes.data || []).forEach((c) => {
          if (c.id && c.name) companyMap.set(c.id, c.name);
        });

        const mappedJobs: JobListing[] = (jobsRes.data || []).map((j) => ({
          id: j.id,
          title: j.title,
          category: j.category || "Software Engineering",
          location: j.location || "Remote",
          type: j.type || "full-time",
          experience_level: j.experience_level || undefined,
          salary_min: j.salary_min ? Number(j.salary_min) : undefined,
          salary_max: j.salary_max ? Number(j.salary_max) : undefined,
          description: j.description,
          created_at: j.created_at,
          company_name: companyMap.get(j.company_id) || undefined,
        }));

        setJobs(mappedJobs);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        logger.error("Failed to fetch jobs list for candidate portal", err?.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  // Extract unique categories from actual jobs
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.category) set.add(j.category);
    });
    return Array.from(set);
  }, [jobs]);

  const filteredJobs = React.useMemo(() => {
    return jobs.filter((j) => {
      // 1. Search Query
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = j.title.toLowerCase().includes(q);
        const matchesCat = j.category.toLowerCase().includes(q);
        const matchesLoc = j.location.toLowerCase().includes(q);
        const matchesCompany = j.company_name ? j.company_name.toLowerCase().includes(q) : false;
        const matchesDesc = j.description ? j.description.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesCat && !matchesLoc && !matchesCompany && !matchesDesc) {
          return false;
        }
      }

      // 2. Category / Domain Filter
      if (selectedCategory !== "ALL" && j.category !== selectedCategory) {
        return false;
      }

      // 3. Employment Type Filter
      if (selectedType !== "ALL") {
        if (selectedType === "remote") {
          if (!j.location.toLowerCase().includes("remote")) return false;
        } else if (j.type.toLowerCase() !== selectedType.toLowerCase()) {
          return false;
        }
      }

      // 4. Experience Level Filter
      if (selectedLevel !== "ALL" && j.experience_level) {
        if (j.experience_level.toLowerCase() !== selectedLevel.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, search, selectedCategory, selectedType, selectedLevel]);

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("ALL");
    setSelectedType("ALL");
    setSelectedLevel("ALL");
  };

  const getCategoryBadgeStyle = (categoryName: string) => {
    return CATEGORY_COLORS[categoryName] || {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200"
    };
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) {
      return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    }
    return `$${((min || max || 0) / 1000).toFixed(0)}k+`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto py-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              SmartHire Job Board
            </span>
            <span className="text-xs font-semibold text-zinc-500">
              {jobs.length} Active Positions
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-2">
            Explore Career Openings
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Filter technical roles by domain, employment type, or experience level to find your next career step.
          </p>
        </div>

        {/* Quick Filter Reset */}
        {(search || selectedCategory !== "ALL" || selectedType !== "ALL" || selectedLevel !== "ALL") && (
          <Button
            onClick={clearFilters}
            variant="outline"
            size="sm"
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 self-start md:self-auto gap-1.5"
          >
            <X className="h-4 w-4" />
            Reset Filters
          </Button>
        )}
      </div>

      {/* Control Bar: Search & Filter Dropdowns */}
      <div className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by job title, domain, company, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            />
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-zinc-400" />
          </div>

          {/* Job Type Dropdown */}
          <div className="w-full md:w-48">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm font-medium text-zinc-700 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            >
              <option value="ALL">All Job Types</option>
              <option value="full-time font-semibold">Full-Time</option>
              <option value="part-time">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="remote">Remote Only</option>
            </select>
          </div>

          {/* Experience Level Dropdown */}
          <div className="w-full md:w-48">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm font-medium text-zinc-700 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            >
              <option value="ALL">All Experience Levels</option>
              <option value="senior">Senior Level</option>
              <option value="lead">Lead / Staff</option>
              <option value="mid">Mid Level</option>
              <option value="entry">Entry Level</option>
            </select>
          </div>
        </div>

        {/* Domain / Category Filter Pills */}
        <div className="pt-2 border-t border-zinc-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            Domains:
          </span>

          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border ${selectedCategory === "ALL"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200"
              }`}
          >
            All Domains ({jobs.length})
          </button>

          {categories.map((cat) => {
            const count = jobs.filter((j) => j.category === cat).length;
            const isSelected = selectedCategory === cat;
            const style = getCategoryBadgeStyle(cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 border ${isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                  }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-zinc-500 font-semibold px-1">
        <span>Showing {filteredJobs.length} {filteredJobs.length === 1 ? "opening" : "openings"}</span>
        {selectedCategory !== "ALL" && (
          <span className="text-blue-600 font-bold">Domain: {selectedCategory}</span>
        )}
      </div>

      {/* Empty State */}
      {filteredJobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-3">
          <Briefcase className="h-10 w-10 text-zinc-400 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900">No matching jobs found</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Try adjusting your search query, selecting a different domain, or clearing active filters.
          </p>
          <Button onClick={clearFilters} variant="outline" size="sm" className="text-xs font-semibold">
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Jobs Grid Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredJobs.map((job) => {
          const catStyle = getCategoryBadgeStyle(job.category);
          const salaryStr = formatSalary(job.salary_min, job.salary_max);

          return (
            <div
              key={job.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col justify-between gap-4 text-left shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className="space-y-3 text-left">
                {/* Highlight Domain & Employment Type */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                    <Layers className="h-3.5 w-3.5" />
                    {job.category}
                  </span>

                  {job.experience_level && (
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider bg-zinc-100 px-2.5 py-0.5 rounded border border-zinc-200">
                      {job.experience_level}
                    </span>
                  )}
                </div>

                {/* Job Title */}
                <div>
                  <h3 className="text-base font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">
                    {job.title}
                  </h3>
                  {job.company_name && (
                    <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                      {job.company_name}
                    </p>
                  )}
                </div>

                {/* Metadata Pills: Location, Salary, Posted Date */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 font-medium pt-1">
                  {job.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      <span>{job.location}</span>
                    </div>
                  )}

                  {salaryStr && (
                    <div className="flex items-center gap-1 text-emerald-700 font-bold">
                      <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{salaryStr}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    <span>{new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Job Description Preview */}
                {job.description && (
                  <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed pt-1">
                    {job.description}
                  </p>
                )}
              </div>

              {/* Footer Action */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-700 uppercase tracking-wider bg-zinc-100 px-2.5 py-1 rounded">
                  <Briefcase className="h-3 w-3 text-zinc-500" />
                  {job.type}
                </span>

                <Link href={`/candidate/jobs/${job.id}`}>
                  <Button size="sm" className="text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                    View Job Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
