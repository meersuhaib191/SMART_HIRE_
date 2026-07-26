"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@smarthire/ui";
import { Award, FileText, CheckCircle2, XCircle, Download, Clock, Calendar, DollarSign, Building2, Briefcase, Loader2, Sparkles } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface CandidateOffer {
  id: string;
  application_id: string;
  job_title: string;
  company_name: string;
  salary_offered: number;
  currency: string;
  position_title: string;
  start_date: string;
  expiry_date: string;
  status: string;
  offer_letter_text: string;
}

export default function CandidateOffersPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [offers, setOffers] = React.useState<CandidateOffer[]>([]);
  const [activeOffer, setActiveOffer] = React.useState<CandidateOffer | null>(null);

  const [actionLoading, setActionLoading] = React.useState(false);
  const [declineModalOpen, setDeclineModalOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");

  const fetchCandidateOffers = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cand } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const candidateId = cand?.id || user.id;

      // Fetch Applications for candidate with offer / hired status
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, job_id, status, joining_status")
        .eq("candidate_id", candidateId);

      if (apps && apps.length > 0) {
        const appIds = apps.map((a) => a.id);
        const offerList: CandidateOffer[] = [];

        for (const app of apps) {
          if (["offer", "offer_sent", "offered", "offer_accepted", "hired", "joined"].includes(app.status)) {
            // Fetch job & company details
            const { data: job } = await supabase.schema("job").from("jobs").select("title, company_id").eq("id", app.job_id).maybeSingle();
            const { data: company } = await supabase.schema("organization").from("companies").select("name").eq("id", job?.company_id || "").maybeSingle();

            offerList.push({
              id: `offer_${app.id}`,
              application_id: app.id,
              job_title: job?.title || "Position",
              company_name: company?.name || "Company",
              salary_offered: 120000,
              currency: "USD",
              position_title: job?.title || "Software Engineer",
              start_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
              expiry_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
              status: app.joining_status === "offer_accepted" || app.status === "hired" ? "accepted" : "sent",
              offer_letter_text: `Dear Candidate,\n\nWe are thrilled to offer you the position of ${job?.title || "Team Member"} at ${company?.name || "SmartHire Partner"}!`,
            });
          }
        }

        setOffers(offerList);
        if (offerList.length > 0) setActiveOffer(offerList[0]);
      }
    } catch (err) {
      logger.error("Failed to load candidate offers", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCandidateOffers();
  }, [fetchCandidateOffers]);

  const handleOfferAction = async (action: "accept" | "decline") => {
    if (!activeOffer) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: activeOffer.application_id,
          action,
          declineReason: action === "decline" ? declineReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Offer action failed");

      fetchCandidateOffers();
      setDeclineModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 text-center">
        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-2" />
        <span className="text-xs font-bold text-zinc-500">Loading Job Offers...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4 text-left sh-animate-in">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-emerald-600" />
          Official Employment Offer Letters
        </h1>
        <p className="text-xs text-zinc-500 font-medium mt-1">
          Review, download, accept or respond to official employment offers.
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Award className="h-10 w-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800">No Employment Offers Available Yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            When you complete your Recruiter Final Interview and are selected by the hiring panel, official offer letters will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Offers List */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Your Offers ({offers.length})</h3>
            {offers.map((off) => (
              <div
                key={off.id}
                onClick={() => setActiveOffer(off)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left space-y-2 ${
                  activeOffer?.id === off.id
                    ? "bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                    : "bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-zinc-900 text-sm">{off.position_title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    off.status === "accepted"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {off.status === "accepted" ? "Accepted" : "Offer Available"}
                  </span>
                </div>
                <span className="text-xs font-bold text-zinc-600 block">{off.company_name}</span>
                <span className="text-xs font-extrabold text-emerald-600 block">
                  {off.currency} {off.salary_offered.toLocaleString()} / Year
                </span>
              </div>
            ))}
          </div>

          {/* Right Column: Offer Letter Detailed Viewer */}
          {activeOffer && (
            <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-6">
              {/* Offer Summary Cards */}
              <div className="bg-gradient-to-r from-zinc-900 via-emerald-950 to-zinc-900 p-6 rounded-2xl text-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      Official Employment Offer
                    </span>
                    <h2 className="text-2xl font-black">{activeOffer.position_title}</h2>
                    <p className="text-xs text-zinc-300 font-medium">{activeOffer.company_name}</p>
                  </div>

                  <div className="text-right bg-white/10 border border-white/20 px-4 py-2 rounded-2xl">
                    <span className="text-[10px] text-zinc-300 font-bold uppercase block">Compensation</span>
                    <span className="text-xl font-black text-emerald-400">
                      {activeOffer.currency} {activeOffer.salary_offered.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Start Date</span>
                    <span className="font-bold text-white">{activeOffer.start_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Expiry Date</span>
                    <span className="font-bold text-amber-400">{activeOffer.expiry_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Offer Status</span>
                    <span className="font-bold text-emerald-400 uppercase">{activeOffer.status}</span>
                  </div>
                </div>
              </div>

              {/* Offer Letter Text Content */}
              <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-2xl space-y-3 font-mono text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap">
                {activeOffer.offer_letter_text}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <Button
                  variant="outline"
                  onClick={() => alert("Downloading official offer letter PDF...")}
                  className="font-bold text-xs gap-1.5 border-zinc-300"
                >
                  <Download className="h-4 w-4 text-zinc-600" /> Download PDF
                </Button>

                {activeOffer.status === "accepted" ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-xs bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" /> Offer Accepted! Welcome to the team.
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeclineModalOpen(true)}
                      disabled={actionLoading}
                      className="font-bold text-xs border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Decline Offer
                    </Button>
                    <Button
                      onClick={() => handleOfferAction("accept")}
                      disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl shadow-sm gap-1.5"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Accept Employment Offer
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
