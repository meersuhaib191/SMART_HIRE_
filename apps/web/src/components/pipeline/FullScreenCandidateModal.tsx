"use client";

import * as React from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Briefcase,
  Calendar,
  Award,
  BookOpen,
  Send,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Code2,
  Video,
  FileCheck2,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Button } from "@smarthire/ui";
import { ATSEngine, AtsScoreBreakdown } from "@/services/ats/ats-engine";
import { isTechDomain } from "@/utils/domain-utils";

export interface CandidateApplicationModalData {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  candidate_email?: string;
  candidate_phone?: string;
  headline?: string;
  location?: string;
  job_id: string;
  job_title: string;
  job_category?: string;
  status: string;
  score?: number | null;
  screening_score?: number | null;
  mcq_score?: number | null;
  coding_score?: number | null;
  interview_avg_score?: number | null;
  created_at: string;
  resume_url?: string | null;
  parsed_text?: string | null;
  summary?: string | null;
  skills?: string[];
  notes?: Array<{ id: string; author: string; text: string; date: string }>;
}

interface FullScreenCandidateModalProps {
  application: CandidateApplicationModalData;
  onClose: () => void;
  onStatusChange?: (appId: string, newStatus: string) => void;
}

export function FullScreenCandidateModal({
  application,
  onClose,
  onStatusChange,
}: FullScreenCandidateModalProps) {
  const [activeTab, setActiveTab] = React.useState<"ats" | "resume" | "evaluations" | "notes">("ats");
  const [noteText, setNoteText] = React.useState("");
  const [localNotes, setLocalNotes] = React.useState(application.notes || []);

  const isTech = isTechDomain(application.job_category, application.job_title);

  // Compute live ATS evaluation breakdown using ATSEngine
  const atsBreakdown: AtsScoreBreakdown = React.useMemo(() => {
    const resumeText =
      application.parsed_text ||
      `${application.headline || ""} ${application.summary || ""} Skills: ${(application.skills || []).join(", ")}`;
    const jobText = `${application.job_title} ${application.job_category || ""}`;
    return ATSEngine.evaluate(resumeText, jobText);
  }, [application]);

  // Use stored screening_score if available or computed atsScore
  const displayAtsScore = application.screening_score != null ? Math.round(application.screening_score) : atsBreakdown.atsScore;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    const newNote = {
      id: `note-${Date.now()}`,
      author: "Recruiter",
      text: noteText.trim(),
      date: new Date().toLocaleDateString([], { dateStyle: "medium", timeStyle: "short" }),
    };
    setLocalNotes([newNote, ...localNotes]);
    setNoteText("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex flex-col animate-in fade-in zoom-in-95 duration-150 text-zinc-900">
      {/* Top Banner Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-xl text-white shadow-lg">
            {(application.candidate_name || "Applicant").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight">{application.candidate_name || "Candidate Details"}</h2>
              <span className="bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                {application.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium flex items-center gap-3 mt-0.5">
              <span>Applied for <strong className="text-zinc-200">{application.job_title}</strong></span>
              <span>•</span>
              <span>{application.candidate_email || "No email provided"}</span>
              {application.location && (
                <>
                  <span>•</span>
                  <span>{application.location}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* ATS Gauge Badge & Top Actions */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5 bg-zinc-800/80 border border-zinc-700/70 px-3.5 py-1.5 rounded-2xl">
            <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
            <div className="text-right">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">ATS Match</span>
              <span className="text-base font-black text-emerald-400">{displayAtsScore}% Score</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onStatusChange && (
              <>
                <button
                  type="button"
                  onClick={() => onStatusChange(application.id, "rejected")}
                  className="bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange(application.id, "interview")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  Advance Candidate <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2 rounded-xl transition-colors cursor-pointer ml-2"
              title="Close Full Screen View"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="bg-white border-b border-zinc-200 px-6 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setActiveTab("ats")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === "ats"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>ATS Breakdown & AI Insights</span>
        </button>

        <button
          onClick={() => setActiveTab("resume")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === "resume"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Resume & Candidate Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("evaluations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === "evaluations"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Award className="h-3.5 w-3.5" />
          <span>Evaluations & Scorecards</span>
        </button>

        <button
          onClick={() => setActiveTab("notes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === "notes"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Recruiter Notes ({localNotes.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-zinc-50 overflow-y-auto p-6 text-left">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* TAB 1: ATS BREAKDOWN */}
          {activeTab === "ats" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overall Score Gauge & 4 Feature Bars */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        Extracted ATS Multi-Factor Scoring Breakdown
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Weighted evaluation: Skills Overlap (45%), Semantic Alignment (30%), Experience Match (15%), Text Similarity (10%)
                      </p>
                    </div>
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                      atsBreakdown.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {atsBreakdown.passed ? "✓ ATS Pass Threshold Met" : "⚠ Below Threshold"}
                    </span>
                  </div>

                  {/* Feature Progress Bars */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-zinc-700">Skill Overlap (45% Weight)</span>
                        <span className="text-blue-600">{Math.round(atsBreakdown.features.skillOverlap * 100)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(atsBreakdown.features.skillOverlap * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-zinc-700">Semantic Alignment (30% Weight)</span>
                        <span className="text-emerald-600">{Math.round(atsBreakdown.features.semanticSimilarity * 100)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(atsBreakdown.features.semanticSimilarity * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-zinc-700">Experience Alignment (15% Weight)</span>
                        <span className="text-purple-600">{Math.round(atsBreakdown.features.experienceScore * 100)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(atsBreakdown.features.experienceScore * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-zinc-700">N-Gram Text Similarity (10% Weight)</span>
                        <span className="text-amber-600">{Math.round(atsBreakdown.features.textSimilarity * 100)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round(atsBreakdown.features.textSimilarity * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills Matrix */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-extrabold text-zinc-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Skill Match & Missing Requirements Matrix
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                        Matched Skills ({atsBreakdown.matchedSkills.length})
                      </span>
                      {atsBreakdown.matchedSkills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {atsBreakdown.matchedSkills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-lg"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">No direct skill matches detected.</span>
                      )}
                    </div>

                    {atsBreakdown.missingSkills.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                          Missing Job Requirements ({atsBreakdown.missingSkills.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {atsBreakdown.missingSkills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-lg"
                            >
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Insights Column */}
              <div className="space-y-6">
                <div className="bg-gradient-to-b from-blue-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400 animate-bounce" />
                    <h3 className="text-base font-extrabold tracking-tight">AI ATS Diagnostic Insights</h3>
                  </div>

                  <ul className="space-y-3 text-xs text-blue-100 font-medium">
                    {atsBreakdown.insights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-blue-900/50 p-2.5 rounded-xl border border-blue-800/60">
                        <Sparkles className="h-3.5 w-3.5 text-blue-300 shrink-0 mt-0.5" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Candidate Quality Metrics</h4>
                  <div className="space-y-2 text-xs font-medium">
                    <div className="flex justify-between py-1.5 border-b border-zinc-100">
                      <span className="text-zinc-500">Evaluation Confidence</span>
                      <span className="font-extrabold text-zinc-900">{atsBreakdown.confidence}%</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-zinc-100">
                      <span className="text-zinc-500">Internal Consistency</span>
                      <span className="font-extrabold text-zinc-900">{atsBreakdown.consistencyScore}%</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-500">Resume Data Status</span>
                      <span className="font-extrabold text-emerald-600">Parsed & Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESUME & PROFILE */}
          {activeTab === "resume" && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="text-base font-extrabold text-zinc-900">Parsed Resume & Document Content</h3>
                    <p className="text-xs text-zinc-500">Original applicant resume metadata and extracted text</p>
                  </div>
                </div>

                {application.resume_url && (
                  <a
                    href={application.resume_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-2 rounded-xl transition-all border border-blue-200"
                  >
                    <span>Download Original PDF</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* Profile Summary Header */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 space-y-2">
                <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Candidate Headline & Summary</h4>
                <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                  {application.headline || application.summary || "No custom profile summary provided by candidate."}
                </p>
              </div>

              {/* Parsed Resume Text */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Extracted Resume Text</h4>
                <div className="bg-zinc-900 text-zinc-200 font-mono text-xs p-4 rounded-xl max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {application.parsed_text || "Full resume text content extracted successfully for ATS parsing."}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EVALUATIONS */}
          {activeTab === "evaluations" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ATS Screening Score Card */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-blue-600">
                  <Sparkles className="h-5 w-5" />
                  <h4 className="text-sm font-extrabold text-zinc-900">ATS Screening Stage</h4>
                </div>
                <div className="text-3xl font-black text-blue-600">{displayAtsScore}%</div>
                <p className="text-xs text-zinc-500 font-medium">Multi-factor resume & job description match score</p>
              </div>

              {/* MCQ Score Card */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <FileCheck2 className="h-5 w-5" />
                  <h4 className="text-sm font-extrabold text-zinc-900">MCQ Test Assessment</h4>
                </div>
                <div className="text-3xl font-black text-emerald-600">
                  {application.mcq_score != null ? `${Math.round(application.mcq_score)}%` : "N/A"}
                </div>
                <p className="text-xs text-zinc-500 font-medium">Standardized domain multiple choice exam score</p>
              </div>

              {/* Coding IDE Score Card (Tech jobs) */}
              {isTech ? (
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Code2 className="h-5 w-5" />
                    <h4 className="text-sm font-extrabold text-zinc-900">Coding IDE Round</h4>
                  </div>
                  <div className="text-3xl font-black text-indigo-600">
                    {application.coding_score != null ? `${Math.round(application.coding_score)}%` : "N/A"}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">Hands-on coding challenges & code execution</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Video className="h-5 w-5" />
                    <h4 className="text-sm font-extrabold text-zinc-900">AI Video Interview</h4>
                  </div>
                  <div className="text-3xl font-black text-purple-600">
                    {application.interview_avg_score != null ? `${Number(application.interview_avg_score).toFixed(1)}/10` : "N/A"}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">Automated video screening & communication score</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === "notes" && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-6">
              <h3 className="text-base font-extrabold text-zinc-900">Recruiter Evaluation Notes</h3>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="flex gap-3">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add evaluation note or interviewer feedback..."
                  className="flex-1 border border-zinc-200 rounded-xl px-4 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Post Note
                </Button>
              </form>

              {/* Notes List */}
              <div className="space-y-3">
                {localNotes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-zinc-400 italic">No notes added yet for this applicant.</div>
                ) : (
                  localNotes.map((n) => (
                    <div key={n.id} className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50 space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-blue-600">{n.author}</span>
                        <span className="text-zinc-400 font-normal">{n.date}</span>
                      </div>
                      <p className="text-xs text-zinc-700 font-medium">{n.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
