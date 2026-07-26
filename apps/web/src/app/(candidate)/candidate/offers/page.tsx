"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@smarthire/ui";
import { Award, FileText, CheckCircle2, XCircle, Download, Clock, Calendar, DollarSign, Building2, Briefcase, Loader2, Sparkles, PenTool } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";
import { resolveCandidateProfileIds } from "@/utils/candidate-helper";

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

  const [signatureName, setSignatureName] = React.useState("");
  const [agreedTerms, setAgreedTerms] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);

  const fetchCandidateOffers = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const candIds = await resolveCandidateProfileIds(supabase, user);
      if (candIds.length === 0) return;

      // Fetch Applications for candidate with offer / hired status
      const { data: apps } = await supabase
        .schema("application")
        .from("applications")
        .select("id, job_id, status, joining_status")
        .in("candidate_id", candIds);

      if (apps && apps.length > 0) {
        const offerList: CandidateOffer[] = [];

        for (const app of apps) {
          if (["offer", "offer_sent", "offered", "offer_accepted", "hired", "joined"].includes(app.status)) {
            // Fetch job & company details
            const { data: job } = await supabase.schema("job").from("jobs").select("title, company_id").eq("id", app.job_id).maybeSingle();
            const { data: company } = await supabase.schema("organization").from("companies").select("name").eq("id", job?.company_id || "").maybeSingle();

            // Fetch custom offer details if saved in API/offers
            let customSalary = 120000;
            let customCurrency = "USD";
            let customPosition = job?.title || "Full Stack Web Developer";
            let customStartDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
            let customExpiryDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
            let customText = `Dear Candidate,\n\nWe are thrilled to offer you the position of ${job?.title || "Full Stack Web Developer"} at ${company?.name || "SmartHire Partner"}! We were extremely impressed by your performance in the technical interview.`;

            try {
              const res = await fetch(`/api/offers?applicationId=${app.id}`);
              const resData = await res.json();
              if (resData?.data) {
                if (resData.data.salary_offered) customSalary = Number(resData.data.salary_offered);
                if (resData.data.currency) customCurrency = resData.data.currency;
                if (resData.data.position_title) customPosition = resData.data.position_title;
                if (resData.data.start_date) customStartDate = resData.data.start_date.split("T")[0];
                if (resData.data.expiry_date) customExpiryDate = resData.data.expiry_date.split("T")[0];
                if (resData.data.offer_letter_text) customText = resData.data.offer_letter_text;
              }
            } catch {
              // Fallback default
            }

            const isAccepted = app.joining_status === "offer_accepted" || app.status === "hired" || app.status === "joined";

            offerList.push({
              id: `offer_${app.id}`,
              application_id: app.id,
              job_title: job?.title || "Full Stack Web Developer",
              company_name: company?.name || "SmartHire Employer",
              salary_offered: customSalary,
              currency: customCurrency,
              position_title: customPosition,
              start_date: customStartDate,
              expiry_date: customExpiryDate,
              status: isAccepted ? "accepted" : "sent",
              offer_letter_text: customText,
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

  const handleAcceptOffer = async () => {
    if (!activeOffer) return;
    if (!signatureName.trim()) {
      alert("Please type your full legal name to sign the offer letter.");
      return;
    }
    if (!agreedTerms) {
      alert("Please check the box agreeing to the employment terms.");
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: activeOffer.application_id,
          action: "accept",
          signatureName,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Offer signing failed");

      alert("🎉 Congratulations! You have digitally signed the offer letter. Your status is now HIRED!");
      fetchCandidateOffers();
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
        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest block">
          Candidate Portal
        </span>
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-emerald-600" />
          Official Employment Offer Letters
        </h1>
        <p className="text-xs text-zinc-500 font-medium mt-1">
          Review, sign, and accept official customized employment offer letters.
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Award className="h-10 w-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800">No Active Employment Offers Available Yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            When you complete your Recruiter Final Interview and are selected by the hiring team, customized offer letters will appear here for signing.
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
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    off.status === "accepted"
                      ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {off.status === "accepted" ? "Hired" : "Offer Sent"}
                  </span>
                </div>
                <span className="text-xs font-bold text-zinc-600 block">{off.company_name}</span>
                <span className="text-xs font-extrabold text-emerald-600 block">
                  {off.currency} {off.salary_offered.toLocaleString()} / Year
                </span>
              </div>
            ))}
          </div>

          {/* Right Column: Offer Letter Detailed Viewer & Signing Box */}
          {activeOffer && (
            <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-6">
              {/* Offer Banner */}
              <div className="bg-gradient-to-r from-zinc-900 via-emerald-950 to-zinc-900 p-6 rounded-2xl text-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      Official Employment Offer
                    </span>
                    <h2 className="text-2xl font-black">{activeOffer.position_title}</h2>
                    <p className="text-xs text-zinc-300 font-medium">{activeOffer.company_name}</p>
                  </div>

                  <div className="text-right bg-white/10 border border-white/20 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-zinc-300 font-bold uppercase block">Base Compensation</span>
                    <span className="text-xl font-black text-emerald-400">
                      {activeOffer.currency} {activeOffer.salary_offered.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Target Start Date</span>
                    <span className="font-bold text-white">{activeOffer.start_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Offer Expiry Date</span>
                    <span className="font-bold text-amber-400">{activeOffer.expiry_date}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Joining Status</span>
                    <span className={`font-extrabold uppercase ${activeOffer.status === "accepted" ? "text-emerald-400" : "text-amber-300"}`}>
                      {activeOffer.status === "accepted" ? "HIRED / JOINED" : "OFFER PENDING SIGNATURE"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Offer Letter Text Document */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider block">Official Offer Letter Content</span>
                <div className="bg-zinc-50 border border-zinc-200 p-6 rounded-2xl space-y-3 font-mono text-xs text-zinc-800 leading-relaxed whitespace-pre-wrap">
                  {activeOffer.offer_letter_text}
                </div>
              </div>

              {/* Signing Box / Status Badge */}
              {activeOffer.status === "accepted" ? (
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between text-emerald-900">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-sm font-black">Offer Signed & Accepted!</h4>
                      <p className="text-xs text-emerald-700 font-medium">Status: <span className="font-extrabold">HIRED</span>. Welcome to {activeOffer.company_name}!</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                    <PenTool className="h-4 w-4 text-emerald-600" /> Digital Signature Required
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700">Type Your Full Legal Name to Sign <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder="e.g. Sheikh Furkan"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-zinc-900 bg-white"
                      />
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-0.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-zinc-600 font-medium">
                        I hereby accept all employment terms, start date, and compensation specified in this official offer letter.
                      </span>
                    </label>

                    <Button
                      onClick={handleAcceptOffer}
                      disabled={actionLoading || !signatureName.trim() || !agreedTerms}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl shadow-md gap-2 cursor-pointer"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Submitting Digital Signature...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Sign & Accept Employment Offer (Status: HIRED)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
