"use client";

import * as React from "react";
import {
  ClipboardCheck, Code2, Star, Award, Calendar,
  Mail, Clock, ChevronRight, Zap
} from "lucide-react";

export interface CandidateAppCard {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  headline?: string;
  job_title: string;
  status: string;
  created_at: string;
  score?: number;
  interview_status?: string;
  tags?: string[];
  priority?: "high" | "medium" | "low";
  screening_score?: number;
  mcq_score?: number;
  mcq_total?: number;
  mcq_passed?: boolean;
  coding_score?: number;
  coding_total?: number;
  coding_passed?: boolean;
  interview_avg_score?: number;
  interview_recommendation?: string;
  interview_scheduled_at?: string;
}

interface ApplicationCardProps {
  card: CandidateAppCard;
  onClick: (card: CandidateAppCard) => void;
}

function MiniScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-zinc-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

function ScoreBadge({ card }: { card: CandidateAppCard }) {
  const { status } = card;

  if (status === "screening" && card.screening_score != null) {
    const pct = (card.screening_score / 10) * 100;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <Zap className="h-3 w-3 text-amber-500" /> ATS Score
          </span>
          <span className={`text-xs font-bold ${pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-600"}`}>
            {card.screening_score}/10
          </span>
        </div>
        <MiniScoreBar
          value={card.screening_score} max={10}
          color={pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}
        />
      </div>
    );
  }

  if (status === "mcq" && card.mcq_score != null && card.mcq_total != null) {
    const pct = (card.mcq_score / card.mcq_total) * 100;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <ClipboardCheck className="h-3 w-3 text-indigo-500" /> MCQ Result
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-700">{card.mcq_score}/{card.mcq_total}</span>
            {card.mcq_passed != null && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                card.mcq_passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {card.mcq_passed ? "PASS" : "FAIL"}
              </span>
            )}
          </div>
        </div>
        <MiniScoreBar
          value={card.mcq_score} max={card.mcq_total}
          color={pct >= 70 ? "bg-indigo-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}
        />
      </div>
    );
  }

  if (status === "coding" && card.coding_score != null && card.coding_total != null) {
    const pct = (card.coding_score / card.coding_total) * 100;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <Code2 className="h-3 w-3 text-emerald-500" /> Code Score
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-zinc-700">{card.coding_score}/{card.coding_total}</span>
            {card.coding_passed != null && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                card.coding_passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {card.coding_passed ? "PASS" : "FAIL"}
              </span>
            )}
          </div>
        </div>
        <MiniScoreBar
          value={card.coding_score} max={card.coding_total}
          color={pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}
        />
      </div>
    );
  }

  if (status === "interview") {
    if (card.interview_avg_score != null) {
      const recMap: Record<string, { label: string; color: string; bg: string }> = {
        strong_hire: { label: "Strong Hire", color: "text-emerald-700", bg: "bg-emerald-100" },
        hire: { label: "Hire", color: "text-green-700", bg: "bg-green-100" },
        neutral: { label: "Neutral", color: "text-amber-700", bg: "bg-amber-100" },
        no_hire: { label: "No Hire", color: "text-orange-700", bg: "bg-orange-100" },
        strong_no_hire: { label: "Strong No Hire", color: "text-red-700", bg: "bg-red-100" },
      };
      const rec = card.interview_recommendation ? recMap[card.interview_recommendation] : null;
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <Star className="h-3 w-3 text-amber-500" /> Interview
            </span>
            <span className="text-xs font-bold text-zinc-700">{card.interview_avg_score}/5</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${
                i <= Math.round(card.interview_avg_score!) ? "bg-amber-400" : "bg-zinc-100"
              }`} />
            ))}
          </div>
          {rec && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${rec.bg} ${rec.color}`}>
              {rec.label}
            </span>
          )}
        </div>
      );
    }

    if (card.interview_scheduled_at) {
      const isPast = new Date(card.interview_scheduled_at) < new Date();
      return (
        <div className={`flex items-center gap-1.5 p-2 rounded-lg ${isPast ? "bg-zinc-50" : "bg-blue-50"}`}>
          <Calendar className={`h-3.5 w-3.5 shrink-0 ${isPast ? "text-zinc-400" : "text-blue-500"}`} />
          <div>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Interview {isPast ? "was" : "scheduled"}</p>
            <p className={`text-[10px] font-bold ${isPast ? "text-zinc-500" : "text-blue-700"}`}>
              {new Date(card.interview_scheduled_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 italic">
        <Clock className="h-3 w-3" /> Awaiting interview scheduling
      </div>
    );
  }

  if (status === "offered") {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
        <Award className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-bold text-emerald-700">Offer Extended 🎉</span>
      </div>
    );
  }

  return null;
}

const AVATAR_COLORS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

export function ApplicationCard({ card, onClick }: ApplicationCardProps) {
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || ""}`.toUpperCase();
  };

  const avatarColor = AVATAR_COLORS[
    (card.candidate_name.charCodeAt(0) + (card.candidate_name.charCodeAt(1) || 0)) % AVATAR_COLORS.length
  ];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const priorityConfig = {
    high: { label: "High", bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-500" },
    medium: { label: "Med", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", dot: "bg-amber-500" },
    low: { label: "Low", bg: "bg-zinc-50", text: "text-zinc-500", border: "border-zinc-200", dot: "bg-zinc-400" },
  };
  const pri = card.priority ? priorityConfig[card.priority] : null;

  const daysSince = Math.floor((Date.now() - new Date(card.created_at).getTime()) / 86400000);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(card)}
      className="group rounded-2xl border border-zinc-200 bg-white p-4 space-y-3.5 cursor-grab active:cursor-grabbing hover:border-blue-200 hover:shadow-[0_4px_20px_0_rgba(0,113,227,0.1)] transition-all duration-150 select-none text-left active:scale-[0.98] active:shadow-sm"
    >
      {/* Avatar + Name + Priority */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} text-white flex items-center justify-center text-[11px] font-bold shadow-sm shrink-0`}>
            {getInitials(card.candidate_name)}
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold text-zinc-900 leading-tight truncate group-hover:text-blue-700 transition-colors">
              {card.candidate_name}
            </h4>
            <span className="text-[11px] text-zinc-500 truncate block">
              {card.headline || "Applicant"}
            </span>
          </div>
        </div>
        {pri && (
          <div className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${pri.bg} ${pri.text} ${pri.border}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
            {pri.label}
          </div>
        )}
      </div>

      {/* Meta: email + date */}
      <div className="space-y-1 pt-1 border-t border-zinc-100">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{card.candidate_email}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince}d ago`}</span>
        </div>
      </div>

      {/* Score/Stage Badge */}
      <div className="border-t border-zinc-100 pt-2.5">
        <ScoreBadge card={card} />
      </div>

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {t}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="text-[9px] text-zinc-400 font-semibold self-center">+{card.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Expand Hint */}
      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-zinc-50">
        <span className="text-[9px] text-zinc-400 font-semibold flex items-center gap-0.5">
          View details <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
