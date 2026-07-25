"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { ArrowLeft, Sparkles, ChevronRight, BarChart3, Award, FileDown, CheckCircle2, UserCheck } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface OfferCandidateItem {
  id: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status: string;
  created_at: string;
}

export default function OffersDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = React.useState<string>("Job Opening");
  const [candidates, setCandidates] = React.useState<OfferCandidateItem[]>([]);
  const [rejectedBaseCount, setRejectedBaseCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  const fetchOffersData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Job Title
      const { data: job } = await supabase
        .schema("job")
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .maybeSingle();

      if (job?.title) setJobTitle(job.title);

      // 2. Fetch Applications for this job in Offer / Selection stage
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, status, created_at")
        .eq("job_id", jobId)
        .is("deleted_at", null);

      const appList = apps || [];

      const rejected = appList.filter((a) => a.status === "rejected" || a.status === "withdrawn").length;
      setRejectedBaseCount(rejected);

      const selectedApps = appList.filter((a) => ["offer_sent", "offer_accepted", "joined", "offered"].includes(a.status));

      if (selectedApps.length > 0) {
        const candidateIds = selectedApps.map((a) => a.candidate_id);
        const { data: cands } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id, first_name, last_name, email, avatar_url")
          .in("id", candidateIds);

        const candMap = new Map<string, any>();
        (cands || []).forEach((c) => candMap.set(c.id, c));

        const mapped: OfferCandidateItem[] = selectedApps.map((app) => {
          const c = candMap.get(app.candidate_id);
          return {
            id: app.id,
            candidate_id: app.candidate_id,
            first_name: c?.first_name || "Applicant",
            last_name: c?.last_name || "",
            email: c?.email || "No email provided",
            avatar_url: c?.avatar_url,
            status: app.status,
            created_at: app.created_at,
          };
        });

        setCandidates(mapped);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      logger.error("Failed to load Offers & Selection details page", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchOffersData();
  }, [fetchOffersData]);

  // Overview Metrics
  const selectedCount = candidates.length;
  const offersGenerated = selectedCount;
  const offersAccepted = candidates.filter((c) => c.status === "offer_accepted" || c.status === "joined").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-4 sm:px-6 text-left sh-animate-in">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
            <Link href="/recruiter/pipeline" className="hover:text-blue-600">Jobs</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-700 font-bold">{jobTitle}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-emerald-600 font-bold">Offers & Selection</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-emerald-600" />
            Offers & Selection Detailed View
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/recruiter/pipeline?jobId=${jobId}`)}
            className="text-xs font-bold gap-1.5 border-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
          </Button>
          <Button
            onClick={() => router.push(`/recruiter/pipeline?jobId=${jobId}`)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Open Full Kanban Board
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Selected Candidates</span>
          <span className="text-2xl font-black text-zinc-900">{selectedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Offers Generated</span>
          <span className="text-2xl font-black text-blue-600">{offersGenerated}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Offers Accepted</span>
          <span className="text-2xl font-black text-emerald-600">{offersAccepted}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Rejected Base</span>
          <span className="text-2xl font-black text-red-600">{rejectedBaseCount}</span>
        </div>
      </div>

      {/* Selected Candidates Table */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Selected Candidates & Offer Status</h3>
          <span className="text-xs font-medium text-zinc-500">{candidates.length} Hires</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-medium">Loading selection & offer records...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">No candidates selected for hire in this position yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">Selection Status</th>
                  <th className="p-3.5">Offer Status</th>
                  <th className="p-3.5">Offer Generated Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {candidates.map((c) => {
                  const isAccepted = c.status === "offer_accepted" || c.status === "joined";

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{c.first_name} {c.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Selected for Hire
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isAccepted ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          {isAccepted ? "Offer Accepted / Joined" : "Offer Letter Issued"}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-zinc-600">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/recruiter/candidates/${c.candidate_id}`)}
                          className="text-[11px] font-bold h-7.5 px-3 border-zinc-300"
                        >
                          View Candidate
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
