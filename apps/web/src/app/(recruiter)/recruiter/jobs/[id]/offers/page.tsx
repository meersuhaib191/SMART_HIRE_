"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@smarthire/ui";
import { ArrowLeft, Sparkles, ChevronRight, BarChart3, Award, FileDown, CheckCircle2, UserCheck, Send, Clock, X, Eye, XCircle, Loader2, CalendarClock } from "lucide-react";
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
  decision_status: string | null;
  joining_status: string | null;
  interview_avg_score: number | null;
  created_at: string;
}

export default function OffersDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [jobTitle, setJobTitle] = React.useState<string>("Job Position");
  const [candidates, setCandidates] = React.useState<OfferCandidateItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Send offer modal state
  const [sendOfferCandidate, setSendOfferCandidate] = React.useState<OfferCandidateItem | null>(null);
  const [offerSalary, setOfferSalary] = React.useState<string>("120000");
  const [offerCurrency, setOfferCurrency] = React.useState<string>("USD");
  const [offerTitle, setOfferTitle] = React.useState<string>("");
  const [offerStartDate, setOfferStartDate] = React.useState<string>("");
  const [offerExpiryDate, setOfferExpiryDate] = React.useState<string>("");
  const [offerText, setOfferText] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  const fetchOffersData = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: job } = await supabase
        .schema("job")
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .maybeSingle();

      if (job?.title) setJobTitle(job.title);

      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, candidate_id, status, decision_status, joining_status, interview_avg_score, created_at")
        .eq("job_id", jobId)
        .is("deleted_at", null);

      const appList = apps || [];
      const selectedApps = appList.filter((a) =>
        ["offer", "offer_sent", "offered", "offer_accepted", "hired", "joined"].includes(a.status) ||
        a.decision_status === "approved_for_offer"
      );

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
            email: c?.email || "No email",
            avatar_url: c?.avatar_url,
            status: app.status,
            decision_status: app.decision_status,
            joining_status: app.joining_status,
            interview_avg_score: app.interview_avg_score,
            created_at: app.created_at,
          };
        });

        setCandidates(mapped);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      logger.error("Failed to load Offers details page", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchOffersData();
  }, [fetchOffersData]);

  // Offer status helpers
  const getOfferStatus = (c: OfferCandidateItem) => {
    if (c.joining_status === "joined" || c.status === "joined") return "Joined";
    if (c.joining_status === "offer_accepted" || c.status === "hired") return "Accepted";
    if (c.status === "offered" || c.status === "offer_sent") return "Sent";
    if (c.decision_status === "approved_for_offer" && c.status !== "offer_sent") return "Draft";
    return "Pending";
  };

  const getOfferStatusColor = (status: string) => {
    switch (status) {
      case "Joined": return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Accepted": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Sent": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Draft": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "bg-zinc-100 text-zinc-600 border-zinc-200";
    }
  };

  // Metrics
  const totalOffers = candidates.length;
  const draftCount = candidates.filter((c) => getOfferStatus(c) === "Draft").length;
  const sentCount = candidates.filter((c) => getOfferStatus(c) === "Sent").length;
  const acceptedCount = candidates.filter((c) => getOfferStatus(c) === "Accepted" || getOfferStatus(c) === "Joined").length;
  const declinedCount = candidates.filter((c) => c.joining_status === "did_not_join").length;

  const handleSendOffer = async () => {
    if (!sendOfferCandidate) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: sendOfferCandidate.id,
          salaryOffered: Number(offerSalary),
          currency: offerCurrency,
          positionTitle: offerTitle || jobTitle,
          startDate: offerStartDate || undefined,
          expiryDate: offerExpiryDate || undefined,
          offerLetterText: offerText || `We are thrilled to offer you the position of ${offerTitle || jobTitle}!`,
          action: "send",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to send offer");
      setSendOfferCandidate(null);
      fetchOffersData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 sm:px-6 text-left sh-animate-in">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold mb-1">
            <Link href="/recruiter/pipeline" className="hover:text-blue-600">Jobs</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-700 font-bold">{jobTitle}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-emerald-600 font-bold">Offer Management</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6 text-emerald-600" />
            Offer Management
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => router.push(`/recruiter/jobs/${jobId}/hiring-decision`)}
            className="text-xs font-bold gap-1.5 border-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Hiring Decision Panel
          </Button>
          <Button
            onClick={() => router.push(`/recruiter/pipeline?jobId=${jobId}`)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> Pipeline Overview
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Offers</span>
          <span className="text-2xl font-black text-zinc-900">{totalOffers}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Draft</span>
          <span className="text-2xl font-black text-amber-600">{draftCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Sent</span>
          <span className="text-2xl font-black text-blue-600">{sentCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Accepted</span>
          <span className="text-2xl font-black text-emerald-600">{acceptedCount}</span>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Declined</span>
          <span className="text-2xl font-black text-red-600">{declinedCount}</span>
        </div>
      </div>

      {/* Offer Roster Table */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
            Offer Lifecycle Tracker
          </h3>
          <span className="text-xs font-medium text-zinc-500">{candidates.length} Offers</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-medium">Loading offer records...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400 font-medium italic">
            No candidates approved for offers yet. Go to{" "}
            <Link href={`/recruiter/jobs/${jobId}/hiring-decision`} className="text-indigo-600 font-bold hover:underline">
              Hiring Decision Panel
            </Link>{" "}
            to approve candidates.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">Final Interview</th>
                  <th className="p-3.5">Offer Status</th>
                  <th className="p-3.5">Joining Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {candidates.map((c) => {
                  const offerStatus = getOfferStatus(c);
                  const statusColor = getOfferStatusColor(offerStatus);

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-zinc-900">
                        <div>
                          <span>{c.first_name} {c.last_name}</span>
                          <span className="block text-[10px] text-zinc-400 font-normal">{c.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-extrabold text-emerald-600">
                        {c.interview_avg_score != null ? `${c.interview_avg_score}%` : "—"}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${statusColor}`}>
                          {offerStatus}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-xs">
                        {c.joining_status ? (
                          <span className="capitalize text-zinc-700">{c.joining_status.replace("_", " ")}</span>
                        ) : "—"}
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        {offerStatus === "Draft" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSendOfferCandidate(c);
                              setOfferTitle(jobTitle);
                              setOfferText(`We are thrilled to offer you the position of ${jobTitle}!`);
                              const start = new Date();
                              start.setDate(start.getDate() + 14);
                              setOfferStartDate(start.toISOString().split("T")[0]);
                              const exp = new Date();
                              exp.setDate(exp.getDate() + 7);
                              setOfferExpiryDate(exp.toISOString().split("T")[0]);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold h-7.5 px-3 shadow-xs"
                          >
                            <Send className="h-3 w-3 mr-1" /> Send Offer
                          </Button>
                        )}

                        {offerStatus === "Sent" && (
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Awaiting Response
                          </span>
                        )}

                        {(offerStatus === "Accepted" || offerStatus === "Joined") && (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {offerStatus}
                          </span>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/recruiter/candidates/${c.candidate_id}`)}
                          className="text-[11px] font-bold h-7.5 px-2.5 border-zinc-300"
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

      {/* Send Offer Modal */}
      {sendOfferCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs sh-animate-in">
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-left">
            <div className="bg-gradient-to-r from-zinc-900 via-emerald-950 to-zinc-900 p-6 text-white relative">
              <button onClick={() => setSendOfferCandidate(null)} className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
                <Award className="h-4 w-4" /> Generate & Send Offer
              </div>
              <h2 className="text-xl font-black tracking-tight">{sendOfferCandidate.first_name} {sendOfferCandidate.last_name}</h2>
              <p className="text-xs text-zinc-300">{jobTitle}</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Position Title</label>
                  <input
                    type="text"
                    value={offerTitle}
                    onChange={(e) => setOfferTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Salary Offered</label>
                  <div className="flex gap-2">
                    <select
                      value={offerCurrency}
                      onChange={(e) => setOfferCurrency(e.target.value)}
                      className="w-20 px-2 py-2 rounded-xl border border-zinc-300 font-bold"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="INR">INR</option>
                    </select>
                    <input
                      type="number"
                      value={offerSalary}
                      onChange={(e) => setOfferSalary(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Start Date</label>
                  <input
                    type="date"
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                    <CalendarClock className="h-3 w-3 text-red-500" /> Offer Expiry Date
                  </label>
                  <input
                    type="date"
                    value={offerExpiryDate}
                    onChange={(e) => setOfferExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px]">Offer Letter Content</label>
                <textarea
                  value={offerText}
                  onChange={(e) => setOfferText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-medium focus:outline-none focus:border-emerald-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <Button variant="outline" onClick={() => setSendOfferCandidate(null)} className="font-bold text-xs">Cancel</Button>
                <Button
                  onClick={handleSendOffer}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm px-5"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {submitting ? "Sending..." : "Send Offer to Candidate"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
