"use client";

import * as React from "react";
import { Button } from "@smarthire/ui";
import { X, Award, CheckCircle2, AlertCircle, FileText, Loader2, Sparkles } from "lucide-react";
import { RecommendationType } from "@/services/interview/interfaces/interview.interface";
import { MeetingService } from "@/services/interview/meeting-service";
import { logger } from "@smarthire/logger";

interface ScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (weightedScore: number, recommendation: string) => void;
  interviewId: string;
  candidateName: string;
  jobTitle?: string;
}

export function ScorecardModal({
  isOpen,
  onClose,
  onSuccess,
  interviewId,
  candidateName,
  jobTitle = "Position",
}: ScorecardModalProps) {
  const [technicalScore, setTechnicalScore] = React.useState<number>(85);
  const [problemSolvingScore, setProblemSolvingScore] = React.useState<number>(80);
  const [communicationScore, setCommunicationScore] = React.useState<number>(85);
  const [experienceScore, setExperienceScore] = React.useState<number>(80);
  const [judgmentScore, setJudgmentScore] = React.useState<number>(85);

  const [technicalNotes, setTechnicalNotes] = React.useState<string>("");
  const [problemSolvingNotes, setProblemSolvingNotes] = React.useState<string>("");
  const [communicationNotes, setCommunicationNotes] = React.useState<string>("");
  const [experienceNotes, setExperienceNotes] = React.useState<string>("");
  const [judgmentNotes, setJudgmentNotes] = React.useState<string>("");

  const [recommendation, setRecommendation] = React.useState<RecommendationType>("hire");
  const [overallNotes, setOverallNotes] = React.useState<string>("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate live weighted score (0-100)
  const weightedScore = MeetingService.calculateWeightedScore({
    technicalScore,
    problemSolvingScore,
    communicationScore,
    experienceScore,
    judgmentScore,
    recommendation,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/interview/${interviewId}/scorecard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicalScore,
          problemSolvingScore,
          communicationScore,
          experienceScore,
          judgmentScore,
          technicalNotes,
          problemSolvingNotes,
          communicationNotes,
          experienceNotes,
          judgmentNotes,
          recommendation,
          overallNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit evaluation scorecard.");
      }

      logger.info("[ScorecardModal] Scorecard submitted successfully", data);
      if (onSuccess) onSuccess(weightedScore, recommendation);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs sh-animate-in overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden text-left">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Award className="h-4 w-4" /> Recruiter Evaluation Scorecard
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight">{candidateName}</h2>
              <p className="text-xs text-zinc-300">{jobTitle}</p>
            </div>
            <div className="text-right shrink-0 bg-white/10 border border-white/20 px-3.5 py-1.5 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">Weighted Score</span>
              <span className="text-2xl font-black text-emerald-400">{weightedScore}%</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Rubric Dimensions */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 border-b border-zinc-200 pb-2">
              Evaluation Rubric (100% Total Weight)
            </h3>

            {/* 1. Role / Technical Competence (35%) */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-zinc-900 text-xs">1. Role / Technical Competence</span>
                  <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Weight: 35%</span>
                </div>
                <span className="font-black text-sm text-zinc-900">{technicalScore}/100</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={technicalScore}
                onChange={(e) => setTechnicalScore(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <input
                type="text"
                placeholder="Evidence / notes on technical depth & competence..."
                value={technicalNotes}
                onChange={(e) => setTechnicalNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* 2. Problem Solving (20%) */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-zinc-900 text-xs">2. Problem Solving & Critical Thinking</span>
                  <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Weight: 20%</span>
                </div>
                <span className="font-black text-sm text-zinc-900">{problemSolvingScore}/100</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={problemSolvingScore}
                onChange={(e) => setProblemSolvingScore(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <input
                type="text"
                placeholder="Evidence / notes on analytical thinking & debugging..."
                value={problemSolvingNotes}
                onChange={(e) => setProblemSolvingNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* 3. Communication (15%) */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-zinc-900 text-xs">3. Communication & Articulation</span>
                  <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Weight: 15%</span>
                </div>
                <span className="font-black text-sm text-zinc-900">{communicationScore}/100</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={communicationScore}
                onChange={(e) => setCommunicationScore(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <input
                type="text"
                placeholder="Evidence / notes on clarity & listening skills..."
                value={communicationNotes}
                onChange={(e) => setCommunicationNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* 4. Relevant Experience (15%) */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-zinc-900 text-xs">4. Relevant Experience & Domain Fit</span>
                  <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Weight: 15%</span>
                </div>
                <span className="font-black text-sm text-zinc-900">{experienceScore}/100</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={experienceScore}
                onChange={(e) => setExperienceScore(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <input
                type="text"
                placeholder="Evidence / notes on past achievements & domain alignment..."
                value={experienceNotes}
                onChange={(e) => setExperienceNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* 5. Professional Judgment (15%) */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-zinc-900 text-xs">5. Professional Judgment & Team Ownership</span>
                  <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Weight: 15%</span>
                </div>
                <span className="font-black text-sm text-zinc-900">{judgmentScore}/100</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={judgmentScore}
                onChange={(e) => setJudgmentScore(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <input
                type="text"
                placeholder="Evidence / notes on leadership & teamwork..."
                value={judgmentNotes}
                onChange={(e) => setJudgmentNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          {/* Final Recruiter Recommendation */}
          <div className="space-y-2 pt-2 border-t border-zinc-200">
            <label className="font-black text-zinc-900 uppercase tracking-wider text-xs block">
              Final Recruiter Assessment Recommendation <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "strong_hire", label: "Strong Hire", color: "bg-emerald-600 text-white" },
                { key: "hire", label: "Hire", color: "bg-blue-600 text-white" },
                { key: "further_review", label: "Further Review", color: "bg-amber-500 text-white" },
                { key: "no_hire", label: "No Hire", color: "bg-red-600 text-white" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRecommendation(opt.key as RecommendationType)}
                  className={`p-2.5 rounded-xl font-extrabold text-xs transition-all border ${
                    recommendation === opt.key
                      ? `${opt.color} shadow-sm border-transparent ring-2 ring-zinc-900/20`
                      : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overall Evaluation Summary */}
          <div className="space-y-1">
            <label className="font-bold text-zinc-700 uppercase tracking-wider text-[11px] block">
              Overall Evaluation Notes & Key Highlights
            </label>
            <textarea
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder="Provide a concise summary of candidate strengths, risks, or key discussion points for the hiring decision panel."
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium text-zinc-900 resize-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
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
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs gap-1.5 shadow-sm px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Save Scorecard & Advance to Hiring Decision
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
