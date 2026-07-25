"use client";

import * as React from "react";
import { Loader2, Calendar, Briefcase, Trophy, CheckCircle2, Search, Filter, History, Sparkles, Building2, MapPin, FileText } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";
import { isTechDomain } from "@/utils/domain-utils";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface HistoryRecord {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  job_title: string;
  job_id: string;
  location?: string;
  category?: string;
  job_status?: string;
  score?: number | null;
  mcq_score?: number | null;
  coding_score?: number | null;
  interview_avg_score?: number | null;
  company_name?: string;
}

export default function CandidateJobHistoryPage() {
  const [records, setRecords] = React.useState<HistoryRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterTab, setFilterTab] = React.useState("all");

  // Offer Letter Viewer Modal State
  const [selectedApp, setSelectedApp] = React.useState<HistoryRecord | null>(null);
  const [offerModalOpen, setOfferModalOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { setLoading(false); return; }

        const { data: profile } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!profile?.id) { setLoading(false); return; }

        const { data: apps, error } = await supabase
          .schema("application")
          .from("applications")
          .select("id, created_at, updated_at, status, job_id, score, mcq_score, coding_score, interview_avg_score")
          .eq("candidate_id", profile.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (apps && apps.length > 0) {
          const jobIds = [...new Set(apps.map((a) => a.job_id))];
          const { data: jobs } = await supabase
            .schema("job")
            .from("jobs")
            .select("id, title, location, category, status, company_id")
            .in("id", jobIds);

          const companyIds = [...new Set((jobs || []).map((j) => j.company_id).filter(Boolean))];
          let companies: { id: string; name: string }[] = [];
          if (companyIds.length > 0) {
            const { data: compList } = await supabase
              .schema("organization")
              .from("companies")
              .select("id, name")
              .in("id", companyIds);
            companies = compList || [];
          }

          const mapped: HistoryRecord[] = apps.map((app) => {
            const job = (jobs || []).find((j) => j.id === app.job_id);
            const comp = companies.find((c) => c.id === job?.company_id);

            return {
              id: app.id,
              created_at: app.created_at,
              updated_at: app.updated_at || app.created_at,
              status: app.status,
              job_title: job?.title || "Position Posting",
              job_id: app.job_id,
              location: job?.location || "Remote",
              category: job?.category || "Technology",
              job_status: job?.status || "published",
              score: app.score,
              mcq_score: app.mcq_score,
              coding_score: app.coding_score,
              interview_avg_score: app.interview_avg_score,
              company_name: comp?.name || "Waadi Media",
            };
          });

          setRecords(mapped);
        }
      } catch (err) {
        logger.error("Failed to load candidate job history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredRecords = React.useMemo(() => {
    return records.filter((r) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        r.job_title.toLowerCase().includes(query) ||
        (r.company_name && r.company_name.toLowerCase().includes(query)) ||
        (r.category && r.category.toLowerCase().includes(query));

      if (filterTab === "hired") {
        return matchesSearch && ["joined", "offer_accepted", "offered", "offer_sent"].includes(r.status);
      }
      if (filterTab === "closed") {
        return matchesSearch && r.job_status === "closed";
      }
      return matchesSearch;
    });
  }, [records, searchQuery, filterTab]);

  const joinedCount = records.filter((r) => ["joined", "offer_accepted"].includes(r.status)).length;
  const offersCount = records.filter((r) => ["offer_sent", "offered", "offer_accepted", "joined"].includes(r.status)).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-zinc-500 font-medium">Loading candidate job history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 text-left animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">
            Candidate Career History
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Job History & Offer Archive
        </h1>
        <p className="text-sm text-zinc-500 font-medium">
          Review your complete application trajectory, signed offer letters, assessment scorecards, and hired position records.
        </p>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Applications", value: records.length, icon: Briefcase, color: "text-blue-600 bg-blue-50 border-blue-100" },
          { label: "Offers Dispatched", value: offersCount, icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-100" },
          { label: "Hired / Joined Roles", value: joinedCount, icon: Trophy, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 flex items-center gap-4 ${stat.color.split(" ").slice(1).join(" ")}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color.split(" ")[0]} ${stat.color.split(" ")[1]}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-zinc-900 tabular-nums">{stat.value}</p>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search role, company, or field..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2 text-xs font-medium text-zinc-800 focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0 mr-1" />
          {[
            { id: "all", label: "All History" },
            { id: "hired", label: "Offers & Hired" },
            { id: "closed", label: "Closed Jobs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                filterTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Records History List */}
      <div className="space-y-4">
        {filteredRecords.map((r) => {
          const isHired = ["joined", "offer_accepted"].includes(r.status);
          const hasOffer = ["offer_sent", "offered", "offer_accepted", "joined"].includes(r.status);

          return (
            <div
              key={r.id}
              className={`rounded-2xl border bg-white p-6 space-y-4 text-left shadow-sm hover:shadow-md transition-all ${
                isHired ? "border-emerald-300 ring-2 ring-emerald-100" : "border-zinc-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    isHired ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-600"
                  }`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-zinc-900">{r.job_title}</h2>
                      <span className="text-xs font-bold text-zinc-500">· {r.company_name}</span>
                      {r.job_status === "closed" && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Job Closed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.location}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Applied {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold capitalize border ${
                    isHired
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : hasOffer
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-zinc-100 text-zinc-700 border-zinc-200"
                  }`}>
                    {isHired && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    {isHired ? "Signed & Hired" : r.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Evaluation scorecards bar */}
              {(() => {
                const isTechJob = isTechDomain(r.category, r.job_title);
                return (
                  <div className={`grid ${isTechJob ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-3 bg-zinc-50/70 p-3 rounded-xl border border-zinc-100 text-xs font-mono`}>
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 block uppercase">ATS Score</span>
                      <span className="font-extrabold text-zinc-800">
                        {r.score != null
                          ? r.score <= 10
                            ? `${Number(r.score).toFixed(1)}/10 (${Math.round(r.score * 10)}%)`
                            : `${Math.round(r.score)}%`
                          : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 block uppercase">MCQ Exam</span>
                      <span className="font-extrabold text-zinc-800">
                        {r.mcq_score != null ? `${Math.round(r.mcq_score)}%` : "N/A"}
                      </span>
                    </div>
                    {isTechJob && (
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 block uppercase">Coding IDE</span>
                        <span className="font-extrabold text-zinc-800">
                          {r.coding_score != null
                            ? r.coding_score <= 10
                              ? `${Number(r.coding_score).toFixed(0)}/10 (${Math.round(r.coding_score * 10)}%)`
                              : `${Math.round(r.coding_score)}%`
                            : "N/A"}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 block uppercase">AI Interview</span>
                      <span className="font-extrabold text-zinc-800">
                        {r.interview_avg_score != null ? `${Number(r.interview_avg_score).toFixed(1)}/10` : "N/A"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400 font-medium">
                  Last Updated: {new Date(r.updated_at).toLocaleDateString()}
                </span>

                {hasOffer && (
                  <button
                    onClick={() => {
                      setSelectedApp(r);
                      setOfferModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" /> View Appointment Offer Document
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredRecords.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-500 italic text-sm">
            No career history records match your search filter.
          </div>
        )}
      </div>

      {/* Offer Letter Viewer Modal */}
      {offerModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200 flex flex-col max-h-[90vh]">
            <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-extrabold tracking-tight">Official Employment Offer Document</h3>
              </div>
              <button
                onClick={() => setOfferModalOpen(false)}
                className="text-zinc-400 hover:text-white h-8 w-8 rounded-full flex items-center justify-center text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-zinc-200/80 flex flex-col items-center">
              {(() => {
                const storedOffer = typeof window !== "undefined"
                  ? JSON.parse(localStorage.getItem(`smarthire_custom_offer_${selectedApp.id}`) || "{}")
                  : {};

                const companyName = storedOffer.companyName || selectedApp.company_name || "Waadi Media";
                const companyDivision = storedOffer.companyDivision || "Corporate HR & Talent Acquisition Division";
                const salary = storedOffer.salary || "$120,000 / annum";
                const joiningDate = storedOffer.joiningDate || "2026-08-06";
                const location = storedOffer.location || selectedApp.location || "San Francisco, CA / Remote";
                const isAccepted = ["offer_accepted", "joined"].includes(selectedApp.status) || Boolean(storedOffer.acceptedAt);

                return (
                  <div className="w-full bg-white text-zinc-900 rounded-2xl shadow-xl p-8 space-y-5 text-left border border-zinc-300 font-sans text-xs">
                    {/* Document Header */}
                    <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-end">
                      <div>
                        <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest block">Official Appointment Document</span>
                        <h2 className="text-base font-black text-zinc-900 tracking-tight mt-0.5 uppercase">{companyName}</h2>
                        <p className="text-[10px] text-zinc-500 font-medium">{companyDivision}</p>
                      </div>
                      <div className="text-right text-[9px] font-mono text-zinc-500 font-bold">
                        <div>REF: OFFER-2026-{selectedApp.id.slice(0, 6)}</div>
                        <div>DATE: {new Date(selectedApp.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}</div>
                      </div>
                    </div>

                    {/* Recipient */}
                    <div className="space-y-0.5">
                      <p className="font-bold text-zinc-900">To:</p>
                      <p className="font-extrabold text-sm text-zinc-900">Applicant Candidate</p>
                      <p className="text-zinc-600 text-[11px]">Position: {selectedApp.job_title}</p>
                    </div>

                    {/* Subject */}
                    <div className="font-bold text-zinc-900 border-l-4 border-emerald-600 pl-3 py-1 bg-emerald-50 text-[11px]">
                      SUBJECT: Employment Offer for Position of {selectedApp.job_title}
                    </div>

                    {/* Body */}
                    <div className="space-y-3 text-zinc-700 text-[11px] leading-normal">
                      <p>Dear Candidate,</p>
                      <p>
                        We are pleased to extend this formal offer of employment to join <span className="font-bold text-zinc-900">{companyName}</span> as a <span className="font-bold text-zinc-900">{selectedApp.job_title}</span>. We were thoroughly impressed by your background, technical scorecards, and performance throughout our evaluation pipeline conducted via the <span className="font-semibold text-zinc-900">SmartHire AI Hiring Platform</span>.
                      </p>
                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-1.5 font-mono text-[10px] text-zinc-900">
                        <div className="flex justify-between"><span>Annual Compensation:</span><span className="font-bold text-emerald-700">{salary}</span></div>
                        <div className="flex justify-between"><span>Joining Date:</span><span className="font-bold">{joiningDate}</span></div>
                        <div className="flex justify-between"><span>Work Location:</span><span className="font-bold">{location}</span></div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="pt-5 border-t border-zinc-200 grid grid-cols-2 gap-6 text-[10px]">
                      <div>
                        <p className="font-bold text-zinc-900">For {companyName}</p>
                        <div className="h-10 my-1 font-serif italic text-emerald-800 text-sm flex items-end">Authorized HR Executive</div>
                        <p className="text-zinc-500 font-semibold border-t border-zinc-300 pt-1">Hiring Manager Signature</p>
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">Candidate Acceptance</p>
                        <div className="h-10 my-1 font-serif italic text-emerald-700 text-xs flex items-end">
                          {isAccepted ? "✅ Digitally Signed & Accepted" : "Pending Acceptance Signature"}
                        </div>
                        <p className="text-zinc-500 font-semibold border-t border-zinc-300 pt-1">Applicant Signature</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-dashed border-zinc-200 text-center text-[9px] text-zinc-400 font-medium">
                      Evaluated & Dispatched via SmartHire AI Hiring Platform
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                🖨️ Print / Download PDF
              </button>

              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
