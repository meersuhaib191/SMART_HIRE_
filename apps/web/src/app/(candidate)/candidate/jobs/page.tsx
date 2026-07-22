"use client";

import * as React from "react";
import Link from "next/link";
import { Search, MapPin, Layers, Calendar, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@smarthire/ui";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface JobListing {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  description?: string;
  created_at: string;
}

export default function CandidateJobsSearchPage() {
  const [jobs, setJobs] = React.useState<JobListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .schema("job")
          .from("jobs")
          .select("id, title, category, location, type, description, created_at")
          .eq("status", "published")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mappedJobs = (data || []).map((j) => ({
          id: j.id,
          title: j.title,
          department: j.category || "General",
          location: j.location || "Remote",
          employment_type: j.type,
          description: j.description,
          created_at: j.created_at,
        }));

        setJobs(mappedJobs);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("FULL ERROR OBJECT:", err);
        logger.error("Failed to fetch jobs list for candidate portal", err?.message || err?.details || JSON.stringify(err) || err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const filteredJobs = React.useMemo(() => {
    if (!search) return jobs;
    const query = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(query) ||
        (j.department && j.department.toLowerCase().includes(query)) ||
        (j.location && j.location.toLowerCase().includes(query))
    );
  }, [jobs, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
          Candidate Portal
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
          Explore Careers openings
        </h1>
        <p className="text-sm text-zinc-700 mt-1">
          Search open technical positions, view salaries, and apply to hiring pipelines.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative w-full border-b border-zinc-200 pb-6">
        <input
          type="text"
          placeholder="Search job title, department, or office location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
        />
        <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-zinc-700" />
      </div>

      {/* Grid listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col justify-between gap-4 text-left shadow-sm hover:border-zinc-300 transition-colors"
          >
            <div className="space-y-2">
              <h3 className="text-base font-bold text-zinc-900">{job.title}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-700 font-medium">
                {job.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-650" />
                    <span>{job.location}</span>
                  </div>
                )}
                {job.department && (
                  <div className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-650" />
                    <span>{job.department}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-650" />
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              {job.description && (
                <p className="text-xs text-zinc-800 line-clamp-2 leading-relaxed">
                  {job.description}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Link href={`/candidate/jobs/${job.id}`}>
                <Button className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1 px-4 h-9 text-xs font-bold rounded-lg shadow-sm">
                  View Specifications <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ))}

        {filteredJobs.length === 0 && (
          <div className="col-span-2 text-center py-12 text-zinc-700 italic text-sm">
            No published jobs match your search parameters.
          </div>
        )}
      </div>
    </div>
  );
}
