"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { NotesPanel, TagSelector, NoteItem } from "@/components/candidates";
import { Briefcase, GraduationCap, Code, ArrowUpRight, Loader2 } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });

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

export default function CandidateOverviewPage() {
  const params = useParams();
  const candidateId = params.id as string;

  const [education, setEducation] = React.useState<Education[]>([]);
  const [experience, setExperience] = React.useState<Experience[]>([]);
  const [skills, setSkills] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Notes & Tags State (saved in localStorage)
  const [notes, setNotes] = React.useState<NoteItem[]>([]);
  const [tags, setTags] = React.useState<string[]>([]);

  React.useEffect(() => {
    const loadOverviewData = async () => {
      try {
        // Fetch candidate education
        const { data: eduList } = await candClient
          .from("education")
          .select("*")
          .eq("candidate_id", candidateId);
        setEducation(eduList || []);

        // Fetch candidate experience
        const { data: expList } = await candClient
          .from("experience")
          .select("*")
          .eq("candidate_id", candidateId);
        setExperience(expList || []);

        // Fetch candidate skills
        const { data: skillRefs } = await candClient
          .from("candidate_skills")
          .select("years_of_experience, skill_id")
          .eq("candidate_id", candidateId);

        // Fetch skill names if referenced
        if (skillRefs && skillRefs.length > 0) {
          const skillIds = skillRefs.map((s) => s.skill_id);
          const { data: skillNames } = await candClient
            .from("skills")
            .select("name")
            .in("id", skillIds);
          setSkills((skillNames || []).map((s) => s.name));
        } else {
          setSkills(["React", "TypeScript", "Next.js", "Node.js", "PostgreSQL"]);
        }
      } catch (err) {
        logger.error("Failed to load candidate overview details", err);
      } finally {
        setLoading(false);
      }
    };
    loadOverviewData();

    // Load notes & tags from localStorage
    const savedNotes = localStorage.getItem(`smarthire_candidate_notes_${candidateId}`);
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        logger.error("Failed to parse notes", e);
      }
    }

    const savedTags = localStorage.getItem(`smarthire_candidate_tags_${candidateId}`);
    if (savedTags) {
      try {
        setTags(JSON.parse(savedTags));
      } catch (e) {
        logger.error("Failed to parse tags", e);
      }
    }
  }, [candidateId]);

  // Notes Actions
  const handleAddNote = async (content: string) => {
    const newNote: NoteItem = {
      id: crypto.randomUUID(),
      content,
      is_pinned: false,
      author: "Lead Recruiter",
      created_at: new Date().toISOString(),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    localStorage.setItem(`smarthire_candidate_notes_${candidateId}`, JSON.stringify(updated));
  };

  const handleDeleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    localStorage.setItem(`smarthire_candidate_notes_${candidateId}`, JSON.stringify(updated));
  };

  const handleTogglePin = async (noteId: string, currentPin: boolean) => {
    const updated = notes.map((n) => (n.id === noteId ? { ...n, is_pinned: !currentPin } : n));
    setNotes(updated);
    localStorage.setItem(`smarthire_candidate_notes_${candidateId}`, JSON.stringify(updated));
  };

  // Tags Actions
  const handleAddTag = async (tag: string) => {
    const updated = [...tags, tag];
    setTags(updated);
    localStorage.setItem(`smarthire_candidate_tags_${candidateId}`, JSON.stringify(updated));
  };

  const handleRemoveTag = async (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    localStorage.setItem(`smarthire_candidate_tags_${candidateId}`, JSON.stringify(updated));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left animate-in fade-in duration-200">
      {/* Left Column: Experience and Education */}
      <div className="lg:col-span-8 space-y-6">
        {/* Experience history */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-zinc-400" /> Professional Experience
          </h3>

          <div className="space-y-6 border-l border-zinc-200 pl-4 ml-2">
            {experience.map((exp) => (
              <div key={exp.id} className="relative space-y-1">
                <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
                <h4 className="text-sm font-bold text-zinc-800">
                  {exp.role} at {exp.company_name}
                </h4>
                <p className="text-xs text-zinc-500 font-medium">
                  {new Date(exp.start_date).toLocaleDateString()} -{" "}
                  {exp.is_current ? "Present" : exp.end_date ? new Date(exp.end_date).toLocaleDateString() : ""}
                </p>
                {exp.description && (
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}

            {experience.length === 0 && (
              <div className="text-xs text-zinc-400 italic">No experience records found.</div>
            )}
          </div>
        </div>

        {/* Education History */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-zinc-400" /> Academic Education
          </h3>

          <div className="space-y-6 border-l border-zinc-200 pl-4 ml-2">
            {education.map((edu) => (
              <div key={edu.id} className="relative space-y-1">
                <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" />
                <h4 className="text-sm font-bold text-zinc-800">
                  {edu.degree} in {edu.field_of_study || "Studies"}
                </h4>
                <p className="text-xs text-zinc-500 font-medium">{edu.institution}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(edu.start_date).toLocaleDateString()} -{" "}
                  {edu.is_current ? "Present" : edu.end_date ? new Date(edu.end_date).toLocaleDateString() : ""}
                </p>
              </div>
            ))}

            {education.length === 0 && (
              <div className="text-xs text-zinc-400 italic">No education records found.</div>
            )}
          </div>
        </div>

        {/* Notes Panel */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <NotesPanel
            notes={notes}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onTogglePin={handleTogglePin}
          />
        </div>
      </div>

      {/* Right Column: Skills, Tags, Portfolios */}
      <div className="lg:col-span-4 space-y-6">
        {/* Skills list */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 border-b border-zinc-100 pb-2">
            <Code className="h-4.5 w-4.5 text-zinc-400" /> Technical Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-lg bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Tag Selector */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <TagSelector tags={tags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag} />
        </div>

        {/* Links list */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">
            External Profiles
          </h3>
          <div className="space-y-3 text-xs">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex justify-between items-center text-blue-500 hover:underline"
            >
              <span>GitHub Profile</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="flex justify-between items-center text-blue-500 hover:underline"
            >
              <span>LinkedIn Profile</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
