"use client";

import * as React from "react";
import { NotesPanel, TagSelector, NoteItem } from "@/components/candidates";
import { X, Mail, Briefcase, GraduationCap, ClipboardCheck, Code2, Star, TrendingUp, UserCheck, Phone, MapPin, FileText, ExternalLink, Video } from "lucide-react";
import { logger } from "@smarthire/logger";
import { CandidateAppCard } from "./ApplicationCard";
import { Skeleton } from "@/components/shared/Skeleton";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });

interface CandidateDrawerProps {
  card: CandidateAppCard | null;
  onClose: () => void;
  onScheduleInterview?: (card: CandidateAppCard) => void;
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
}

interface Experience {
  id: string;
  company_name: string;
  role: string;
  description?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
}

interface CandidateProfile {
  id: string;
  avatar_url?: string;
  phone?: string;
  location?: string;
  bio?: string;
  resume_url?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
}

export function CandidateDrawer({ card, onClose, onScheduleInterview }: CandidateDrawerProps) {
  const [loading, setLoading] = React.useState(false);
  const [education, setEducation] = React.useState<Education[]>([]);
  const [experience, setExperience] = React.useState<Experience[]>([]);
  const [profile, setProfile] = React.useState<CandidateProfile | null>(null);
  const [notes, setNotes] = React.useState<NoteItem[]>([]);
  const [tags, setTags] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!card) return;

    const loadDrawerDetails = async () => {
      setLoading(true);
      try {
        const { data: candProf } = await candClient
          .from("candidates")
          .select("id, avatar_url, phone, location, bio, resume_url, linkedin_url, github_url, portfolio_url")
          .eq("id", card.candidate_id)
          .maybeSingle();
        if (candProf) setProfile(candProf);

        const { data: edu } = await candClient
          .from("education")
          .select("*")
          .eq("candidate_id", card.candidate_id);
        setEducation(edu || []);

        const { data: exp } = await candClient
          .from("experience")
          .select("*")
          .eq("candidate_id", card.candidate_id);
        setExperience(exp || []);
      } catch (err) {
        logger.error("Failed to load details inside pipeline drawer", err);
      } finally {
        setLoading(false);
      }
    };
    loadDrawerDetails();

    const savedNotes = localStorage.getItem(`smarthire_candidate_notes_${card.candidate_id}`);
    setNotes(savedNotes ? JSON.parse(savedNotes) : []);

    const savedTags = localStorage.getItem(`smarthire_candidate_tags_${card.candidate_id}`);
    setTags(savedTags ? JSON.parse(savedTags) : []);
  }, [card]);

  /* Outside click listener to close drawer when clicking backdrop */
  const drawerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // check if it clicked outside of the drawer
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        // click was outside, check if it's not a kanban card click
        const target = e.target as HTMLElement;
        if (!target.closest("[draggable]")) {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  if (!card) return null;

  const handleAddNote = async (content: string) => {
    const newNote: NoteItem = {
      id: String(Date.now()),
      content,
      created_at: new Date().toISOString(),
      author: "Recruiter Admin",
      is_pinned: false,
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    localStorage.setItem(`smarthire_candidate_notes_${card.candidate_id}`, JSON.stringify(updated));
  };

  const handleDeleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    localStorage.setItem(`smarthire_candidate_notes_${card.candidate_id}`, JSON.stringify(updated));
  };

  const handleTogglePin = async (noteId: string, currentPin: boolean) => {
    const updated = notes.map((n) => (n.id === noteId ? { ...n, is_pinned: !currentPin } : n));
    setNotes(updated);
    localStorage.setItem(`smarthire_candidate_notes_${card.candidate_id}`, JSON.stringify(updated));
  };

  const handleAddTag = async (tag: string) => {
    const updated = [...tags, tag];
    setTags(updated);
    localStorage.setItem(`smarthire_candidate_tags_${card.candidate_id}`, JSON.stringify(updated));
  };

  const handleRemoveTag = async (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    localStorage.setItem(`smarthire_candidate_tags_${card.candidate_id}`, JSON.stringify(updated));
  };

  return (
    <div
      ref={drawerRef}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-[#D2D2D7] shadow-xl p-6 overflow-y-auto sh-slide-right flex flex-col justify-between"
    >
      {/* Top Header with Profile Picture */}
      <div className="space-y-5">
        <div className="flex justify-between items-start border-b border-[#E8E8ED] pb-4">
          <div className="flex items-center gap-3.5 text-left">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={card.candidate_name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/30 shadow-md shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-xl flex items-center justify-center shadow-md shrink-0">
                {card.candidate_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-0.5">
              <h2 className="text-[17px] font-extrabold text-[#1D1D1F]">{card.candidate_name}</h2>
              <p className="text-[12px] text-[#6E6E73] font-medium">{card.headline || "Applicant profile"}</p>
              {profile?.location && (
                <p className="text-[11px] text-zinc-500 flex items-center gap-1 font-medium">
                  <MapPin className="h-3 w-3 text-zinc-400" /> {profile.location}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-[10px] flex items-center justify-center border border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F2F2F2] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Schedule Interview Action Button */}
        {onScheduleInterview && (
          <button
            onClick={() => {
              onScheduleInterview(card);
              onClose();
            }}
            className="w-full bg-[#5E5CE6] hover:bg-[#4B49C6] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="h-4 w-4" /> Schedule Interview for {card.candidate_name}
          </button>
        )}

        {/* Audit AI Video Interview Action Banner */}
        {(card.status === "interview" || card.status === "recruiter_review" || card.interview_avg_score != null) && (
          <a
            href={`/recruiter/interviews/${card.id}`}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Video className="h-4 w-4" /> Audit AI Interview & Scorecard →
          </a>
        )}

        {/* Candidate Profile Specs & Resume Hub */}
        <div className="space-y-3 text-[12px] text-[#6E6E73] text-left bg-[#F5F5F7] p-4 rounded-[16px] border border-[#D2D2D7]">
          <h4 className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider">Candidate Contact Specs</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#AEAEB2] shrink-0" />
              <span className="truncate">{card.candidate_email}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#AEAEB2] shrink-0" />
                <span className="truncate">{profile.phone}</span>
              </div>
            )}
            {card.job_title && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <Briefcase className="h-4 w-4 text-[#AEAEB2] shrink-0" />
                <span className="truncate">Position: <span className="font-semibold text-[#1D1D1F]">{card.job_title}</span></span>
              </div>
            )}
          </div>

          {/* Bio / Summary */}
          {profile?.bio && (
            <p className="text-[11px] text-zinc-600 italic bg-white/70 p-2.5 rounded-xl border border-zinc-200/80 leading-relaxed">
              "{profile.bio}"
            </p>
          )}

          {/* Candidate Resume Download / View Button */}
          {profile?.resume_url ? (
            <a
              href={profile.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <FileText className="h-4 w-4" /> View / Download Candidate Resume PDF <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 italic pt-1">
              <FileText className="h-3.5 w-3.5" /> Standard ATS parsed resume available in screening breakdown
            </div>
          )}
        </div>

        {/* Tag Selector */}
        <div className="bg-[#F5F5F7] p-4 rounded-[16px] border border-[#D2D2D7]">
          <TagSelector tags={tags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
        </div>

        {/* Stage Results Timeline */}
        {card && (
          <div className="bg-[#F5F5F7] p-4 rounded-[16px] border border-[#D2D2D7] space-y-4 text-left">
            <h4 className="text-[11px] font-bold text-[#6E6E73] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#AEAEB2]" /> Stage Results
            </h4>

            <div className="space-y-3 pl-3 border-l-2 border-[#D2D2D7] ml-1">
              {/* Screening Score */}
              <div className="relative">
                <span className="absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#F5F5F7] bg-[#0071E3]" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5 text-[#0071E3]" />
                    <span className="text-[12px] font-semibold text-[#1D1D1F]">Profile Screening</span>
                  </div>
                  {card.screening_score != null ? (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      card.screening_score >= 7
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : card.screening_score >= 4
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-red-700 bg-red-50 border-red-200"
                    }`}>
                      {card.screening_score}/10
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#AEAEB2] italic font-medium">Not scored</span>
                  )}
                </div>
                {card.screening_score != null && (
                  <div className="mt-1.5 h-1.5 w-full bg-[#E8E8ED] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        card.screening_score >= 7 ? "bg-emerald-500" : card.screening_score >= 4 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${(card.screening_score / 10) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* MCQ Test */}
              <div className="relative">
                <span className={`absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#F5F5F7] ${
                  card.mcq_score != null ? "bg-[#5E5CE6]" : "bg-[#D2D2D7]"
                }`} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5 text-[#5E5CE6]" />
                    <span className="text-[12px] font-semibold text-[#1D1D1F]">MCQ Test</span>
                  </div>
                  {card.mcq_score != null && card.mcq_total != null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#5E5CE6] bg-[#EEEEFF] px-2 py-0.5 rounded-full border border-[#D4D4FF]">
                        {card.mcq_score}/{card.mcq_total} ({Math.round((card.mcq_score / card.mcq_total) * 100)}%)
                      </span>
                      {card.mcq_passed != null && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                          card.mcq_passed
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-red-700 bg-red-50 border-red-200"
                        }`}>
                          {card.mcq_passed ? "Passed" : "Failed"}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#AEAEB2] italic font-medium">Pending</span>
                  )}
                </div>
              </div>

              {/* Coding Round */}
              <div className="relative">
                <span className={`absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#F5F5F7] ${
                  card.coding_score != null ? "bg-[#E04430]" : "bg-[#D2D2D7]"
                }`} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5 text-[#E04430]" />
                    <span className="text-[12px] font-semibold text-[#1D1D1F]">Coding Round</span>
                  </div>
                  {card.coding_score != null && card.coding_total != null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-[#E04430] bg-[#FFF0EE] px-2 py-0.5 rounded-full border border-[#FFCFCC]">
                        {card.coding_score}/{card.coding_total} ({Math.round((card.coding_score / card.coding_total) * 100)}%)
                      </span>
                      {card.coding_passed != null && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                          card.coding_passed
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-red-700 bg-red-50 border-red-200"
                        }`}>
                          {card.coding_passed ? "Passed" : "Failed"}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#AEAEB2] italic font-medium">Pending</span>
                  )}
                </div>
              </div>

              {/* Interview */}
              <div className="relative">
                <span className={`absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[#F5F5F7] ${
                  card.interview_avg_score != null ? "bg-[#0071E3]" : "bg-[#D2D2D7]"
                }`} />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-[#0071E3]" />
                      <span className="text-[12px] font-semibold text-[#1D1D1F]">AI Video Interview</span>
                    </div>
                    {card.interview_avg_score != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#0071E3] bg-[#EAF3FF] px-2 py-0.5 rounded-full border border-[#C5DCFF]">
                          {card.interview_avg_score}/5
                        </span>
                        {card.interview_recommendation && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                            card.interview_recommendation === "strong_hire" || card.interview_recommendation === "hire"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : card.interview_recommendation === "neutral"
                                ? "text-amber-700 bg-amber-50 border-amber-200"
                                : "text-red-700 bg-red-50 border-red-200"
                          }`}>
                            {card.interview_recommendation.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#AEAEB2] italic font-medium">Awaiting</span>
                    )}
                  </div>
                  <div className="pt-1">
                    <a
                      href={`/recruiter/interviews/${card.id}`}
                      className="text-[10px] font-bold text-[#0071E3] hover:underline inline-flex items-center gap-1"
                    >
                      Audit AI Video Interview & Transcript →
                    </a>
                  </div>
                </div>
              </div>

              {/* AI Recruiter Intelligence & Suggested Zoom Interview Questions */}
              <div className="mt-4 p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">AI Recruiter Intelligence</span>
                  <span className="text-[9px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">Optimal Fit</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-zinc-700">
                  <p className="font-semibold text-zinc-900">Suggested Final Zoom Interview Topics:</p>
                  <ul className="list-disc list-inside text-[10px] space-y-1 text-zinc-600">
                    <li>Probe deep into concurrent data stream aggregation & memory overhead.</li>
                    <li>Discuss candidate's leadership style in microservice deployments.</li>
                    <li>Confirm salary expectations ($115k – $135k market benchmark).</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details loader */}
        {loading ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-4 w-1/4 rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Experience timeline */}
            <div className="space-y-3 text-left">
              <h4 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#AEAEB2]" /> Experience
              </h4>
              <div className="space-y-3.5 pl-3 border-l border-[#E8E8ED] ml-1">
                {experience.map((exp) => (
                  <div key={exp.id} className="text-[12px] space-y-1 relative">
                    {/* Visual dot on line */}
                    <span className="absolute -left-[16.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0071E3] ring-4 ring-white" />
                    <p className="font-semibold text-[#1D1D1F]">
                      {exp.role} at {exp.company_name}
                    </p>
                    <p className="text-[11px] text-[#6E6E73] tabular-nums">
                      {new Date(exp.start_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })} -{" "}
                      {exp.is_current ? "Present" : exp.end_date ? new Date(exp.end_date).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : ""}
                    </p>
                  </div>
                ))}
                {experience.length === 0 && (
                  <p className="text-[12px] text-[#AEAEB2] italic">No experience logged.</p>
                )}
              </div>
            </div>

            {/* Education Timeline */}
            <div className="space-y-3 text-left">
              <h4 className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[#AEAEB2]" /> Education
              </h4>
              <div className="space-y-3.5 pl-3 border-l border-[#E8E8ED] ml-1">
                {education.map((edu) => (
                  <div key={edu.id} className="text-[12px] space-y-1 relative">
                    {/* Visual dot on line */}
                    <span className="absolute -left-[16.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0071E3] ring-4 ring-white" />
                    <p className="font-semibold text-[#1D1D1F]">
                      {edu.degree} in {edu.field_of_study || "Studies"}
                    </p>
                    <p className="text-[11px] text-[#6E6E73]">{edu.institution}</p>
                  </div>
                ))}
                {education.length === 0 && (
                  <p className="text-[12px] text-[#AEAEB2] italic">No education logged.</p>
                )}
              </div>
            </div>

            {/* Private Notes Panel */}
            <div className="border-t border-[#E8E8ED] pt-5">
              <NotesPanel
                notes={notes}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
