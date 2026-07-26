"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import { X, Calendar, Clock, UserCheck, FileText, Sparkles, Loader2, Video } from "lucide-react";
import { logger } from "@smarthire/logger";

interface ScheduleFinalInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  applicationId: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle?: string;
  defaultInterviewerName?: string;
}

export function ScheduleFinalInterviewModal({
  isOpen,
  onClose,
  onSuccess,
  applicationId,
  candidateName,
  candidateEmail,
  jobTitle = "Position",
  defaultInterviewerName = "Lead Recruiter",
}: ScheduleFinalInterviewModalProps) {
  const [scheduledAt, setScheduledAt] = React.useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = React.useState<string>("60");
  const [interviewerName, setInterviewerName] = React.useState<string>(defaultInterviewerName);
  const [focusNotes, setFocusNotes] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      setError("Please select an interview date and time.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          scheduledAt,
          durationMinutes: Number(durationMinutes),
          interviewerName,
          notes: focusNotes,
          interviewType: "zoom_interview", // Native Recruiter Final Interview
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to schedule Recruiter Final Interview.");
      }

      logger.info("[ScheduleFinalInterviewModal] Successfully scheduled interview", data);
      alert(`Recruiter Final Interview successfully scheduled for ${candidateName}! Native SmartHire meeting room created.`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs sh-animate-in">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-left">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Video className="h-4 w-4" /> Native SmartHire Room
          </div>
          <h2 className="text-xl font-black tracking-tight">Schedule Recruiter Final Interview</h2>
          <p className="text-xs text-zinc-300 mt-1">
            For <span className="font-bold text-white">{candidateName}</span> ({jobTitle})
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Date & Time */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              Interview Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium text-zinc-900"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              Duration <span className="text-red-500">*</span>
            </label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-bold text-zinc-900"
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes (Default)</option>
              <option value="75">75 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </div>

          {/* Assigned Interviewer */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Interviewer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="e.g. Lead Hiring Manager"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium text-zinc-900"
            />
          </div>

          {/* Interview Focus / Notes */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <FileText className="h-3.5 w-3.5 text-zinc-500" />
              Interview Focus / Notes (Optional)
            </label>
            <textarea
              value={focusNotes}
              onChange={(e) => setFocusNotes(e.target.value)}
              placeholder="Focus on project ownership, system-design decisions and communication."
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium text-zinc-900 resize-none"
            />
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Automated Native Meeting Room</span>
              SmartHire automatically generates a secure live video room & waiting lobby. No Google Meet URL required.
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-sm px-5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scheduling...
                </>
              ) : (
                <>
                  <Video className="h-3.5 w-3.5" /> Schedule Interview
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
