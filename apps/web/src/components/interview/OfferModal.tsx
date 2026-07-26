"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import { X, Gift, DollarSign, Calendar, FileText, Sparkles, Loader2 } from "lucide-react";
import { logger } from "@smarthire/logger";

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  applicationId: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle?: string;
}

export function OfferModal({
  isOpen,
  onClose,
  onSuccess,
  applicationId,
  candidateName,
  candidateEmail,
  jobTitle = "Full Stack Web Developer",
}: OfferModalProps) {
  const [positionTitle, setPositionTitle] = React.useState(jobTitle);
  const [salaryOffered, setSalaryOffered] = React.useState("120000");
  const [currency, setCurrency] = React.useState("USD");
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [expiryDate, setExpiryDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [offerLetterText, setOfferLetterText] = React.useState(
    `Dear ${candidateName},\n\nWe are thrilled to extend an official offer of employment for the position of ${jobTitle} at SmartHire!\n\nKey Highlights & Benefits:\n- Competitive Base Compensation & Performance Incentives\n- Comprehensive Health, Dental & Vision Insurance Coverage\n- Flexible Remote & Hybrid Work Environment\n- Paid Time Off (PTO) & Professional Development Stipend\n\nPlease review the terms outlined above and sign your offer letter in your SmartHire Candidate Portal prior to the expiration date.`
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          positionTitle,
          salaryOffered: Number(salaryOffered),
          currency,
          startDate,
          expiryDate,
          offerLetterText,
          action: "send",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate offer letter.");
      }

      logger.info("[OfferModal] Offer successfully sent", data);
      alert(`Official Offer Letter generated and sent to ${candidateName}'s Candidate Portal! Application moved to Offer Stage.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs sh-animate-in">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-left">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-emerald-950 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Gift className="h-4 w-4" /> Official Employment Offer
          </div>
          <h2 className="text-xl font-black tracking-tight">Generate Customized Offer Letter</h2>
          <p className="text-xs text-zinc-300 mt-1">
            For <span className="font-bold text-white">{candidateName}</span> ({candidateEmail || "Candidate"})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Position Title */}
            <div className="space-y-1 sm:col-span-2">
              <label className="font-bold text-zinc-700 uppercase tracking-wider text-[10px]">
                Position Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-zinc-900"
              />
            </div>

            {/* Salary */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-emerald-600" />
                Annual Base Salary <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-2.5 py-2.5 rounded-xl border border-zinc-300 font-bold bg-zinc-50"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <input
                  type="number"
                  value={salaryOffered}
                  onChange={(e) => setSalaryOffered(e.target.value)}
                  required
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-zinc-900"
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <label className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-emerald-600" />
                Target Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-zinc-900"
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-1 sm:col-span-2">
              <label className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Calendar className="h-3 w-3 text-amber-600" />
                Offer Expiration Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-bold text-zinc-900"
              />
            </div>
          </div>

          {/* Offer Letter Text */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <FileText className="h-3 w-3 text-zinc-500" />
              Customized Offer Letter Text & Terms
            </label>
            <textarea
              value={offerLetterText}
              onChange={(e) => setOfferLetterText(e.target.value)}
              rows={6}
              className="w-full p-3.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium text-zinc-800 leading-relaxed resize-none"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Automated Candidate Portal Delivery</span>
              Sending will immediately update candidate status to <span className="font-bold">Offer Extended</span> and deliver this official offer document to candidate's panel for digital signing.
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="font-bold text-xs border-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-md px-6 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Gift className="h-3.5 w-3.5" /> Generate & Send Official Offer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
