"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@smarthire/ui";
import { Briefcase, GraduationCap, Code, Loader2, Save, Trash2, Plus, Calendar, Camera, Upload } from "lucide-react";
import { logger } from "@smarthire/logger";

interface Education {
  id?: string;
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
}

interface Experience {
  id?: string;
  company_name: string;
  job_title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
}

const SKILLS_POOL = [
  // 1. Frontend Development (Web)
  "JavaScript (ES6+)", "TypeScript", "React.js", "Next.js", "Vue.js", "Nuxt.js", "Angular", 
  "HTML5 (Semantic Markup)", "CSS3 & Modern Layouts (Grid / Flexbox)", "Tailwind CSS", "SASS / SCSS", 
  "CSS Modules", "State Management (Redux Toolkit)", "State Management (Zustand)", 
  "State Management (Context API)", "Web Workers & Multi-threading", "WebAssembly (Wasm)", 
  "Progressive Web Apps (PWA)", "Responsive Web Design", "Single Page Applications (SPA)", 
  "Server-Side Rendering (SSR)", "Static Site Generation (SSG)",
  // 2. Mobile App Development
  "Swift (iOS)", "UIKit / SwiftUI (iOS)", "Kotlin (Android)", "Jetpack Compose (Android)", 
  "React Native", "Flutter", "Dart", "Objective-C", "Java (Android)", "App Store Connect & Deployment", 
  "Google Play Console & Deployment", "Mobile Push Notifications (APNS/FCM)", 
  "Mobile Deep Linking (Universal Links)", "On-Device Storage (CoreData / Room / SQLite)",
  // 3. Backend & API Engineering
  "Node.js", "Express.js", "NestJS", "Python (Django)", "Python (Flask / FastAPI)", "Ruby on Rails", 
  "Go (Golang)", "Java (Spring Boot)", "C# (.NET Core)", "RESTful API Architecture", 
  "GraphQL (Apollo Client/Server)", "gRPC / Protocol Buffers", "WebSockets (Real-time communication)", 
  "Serverless Functions (AWS Lambda / Vercel)", "Microservices Architecture", "Message Brokers (RabbitMQ)", 
  "Event Streaming (Apache Kafka)",
  // 4. Databases & Data Layer
  "PostgreSQL", "MySQL", "MongoDB", "Redis (Caching & Session Store)", "Supabase (BaaS)", 
  "Firebase Firestore / Realtime DB", "SQLite", "DynamoDB (AWS)", "Prisma (ORM)", "Mongoose (ODM)", 
  "Database Indexing & Query Optimization", "Database Migrations Management", 
  "Data Warehousing (Snowflake / BigQuery)",
  // 5. DevOps, Cloud & Infrastructure
  "Amazon Web Services (AWS)", "Google Cloud Platform (GCP)", "Microsoft Azure", 
  "Docker (Containerization)", "Kubernetes (Orchestration)", "GitHub Actions (CI/CD workflows)", 
  "GitLab CI", "Terraform (Infrastructure as Code)", "Linux System Administration", 
  "Nginx / Apache (Reverse Proxies)", "Content Delivery Networks (CDN / Cloudflare)", 
  "Server Monitoring (Prometheus / Grafana)", "Log Management (ELK Stack / Datadog)",
  // 6. Architecture, Security & Testing
  "Git & Version Control Workflow (Gitflow)", "System Architecture Design", 
  "Object-Oriented Programming (OOP)", "Functional Programming", "JSON Web Tokens (JWT) Authentication", 
  "OAuth 2.0 & OpenID Connect", "Role-Based Access Control (RBAC)", "SSL/TLS & HTTPS Configuration", 
  "CORS Policy Management", "Data Encryption (AES / RSA)", "Unit Testing (Jest / Mocha)", 
  "Integration Testing (Supertest)", "End-to-End Testing (Cypress / Playwright)", "Mobile Testing (Appium)",
  // 7. Performance & Optimization
  "Lighthouse Performance Auditing", "Core Web Vitals Optimization", "Lazy Loading & Code Splitting", 
  "API Response Caching Strategies", "Database Connection Pooling", 
  "Asset Optimization (Image compression, Minification)", "Memory Leak Debugging",
  // 8. Emerging Tech & Integrations
  "AI/LLM API Integration (OpenAI / Anthropic)", "Vector Databases (Pinecone / Chroma)", 
  "Stripe API (Payment Gateway Integration)", "Third-Party Auth (Google / Apple Sign-In)", 
  "Internationalization (i18n)", "Web Accessibility Standards (WCAG 2.1)", 
  "Headless CMS Integration (Strapi / Sanity)"
];

export default function CandidateProfilePage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const supabase = createClient();

  // Candidate Profile State
  const [candId, setCandId] = React.useState<string | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string>("");
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parsedResume, setParsedResume] = React.useState<any>(null);

  // Sub-items
  const [education, setEducation] = React.useState<Education[]>([]);
  const [experience, setExperience] = React.useState<Experience[]>([]);
  const [skills, setSkills] = React.useState<string[]>([]);
  const [newSkill, setNewSkill] = React.useState("");
  const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // Add Education Form State
  const [showEduForm, setShowEduForm] = React.useState(false);
  const [eduInstitution, setEduInstitution] = React.useState("");
  const [eduDegree, setEduDegree] = React.useState("");
  const [eduField, setEduField] = React.useState("");
  const [eduStart, setEduStart] = React.useState("");
  const [eduEnd, setEduEnd] = React.useState("");
  const [eduIsCurrent, setEduIsCurrent] = React.useState(false);

  // Add Experience Form State
  const [showExpForm, setShowExpForm] = React.useState(false);
  const [expCompanyName, setExpCompanyName] = React.useState("");
  const [expRole, setExpRole] = React.useState("");
  const [expDesc, setExpDesc] = React.useState("");
  const [expStart, setExpStart] = React.useState("");
  const [expEnd, setExpEnd] = React.useState("");
  const [expIsCurrent, setExpIsCurrent] = React.useState(false);

  // Close suggestions box on click outside
  const autocompleteRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProfileDetails = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      // Default pre-fills from Auth user
      const meta = authUser.user_metadata || {};
      const defaultFirst = meta.first_name || meta.firstName || (authUser.email ? authUser.email.split("@")[0] : "Candidate");
      const defaultLast = meta.last_name || meta.lastName || "";

      setFirstName(defaultFirst);
      setLastName(defaultLast);
      setEmail(authUser.email || "");

      // Check local candidate profile backup
      const localKey = `smarthire_candidate_profile_${authUser.id}`;
      try {
        const localRaw = localStorage.getItem(localKey);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          if (parsed.firstName) setFirstName(parsed.firstName);
          if (parsed.lastName) setLastName(parsed.lastName);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.headline) setHeadline(parsed.headline);
          if (parsed.location) setLocation(parsed.location);
          if (parsed.summary) setSummary(parsed.summary);
          if (parsed.skills) setSkills(parsed.skills);
          if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
        }
      } catch {
        // Ignore storage errors
      }

      // 1. Fetch Candidate Record from Database
      let { data: profile } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id, first_name, last_name, email, phone, headline, location, summary, tags, avatar_url")
        .eq("user_id", authUser.id)
        .maybeSingle();

      // 2. Auto-create Candidate Profile row if not exists
      if (!profile) {
        try {
          const { data: newProfile } = await supabase
            .schema("candidate")
            .from("candidates")
            .insert({
              user_id: authUser.id,
              email: authUser.email || "",
              first_name: defaultFirst,
              last_name: defaultLast,
              summary: "",
              tags: ["React", "TypeScript"]
            })
            .select("id, first_name, last_name, email, phone, headline, location, summary, tags, avatar_url")
            .maybeSingle();

          if (newProfile) profile = newProfile;
        } catch (e) {
          logger.warn("Auto-creation of candidate profile row skipped", e);
        }
      }

      if (profile) {
        setCandId(profile.id);
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.last_name) setLastName(profile.last_name);
        if (profile.email) setEmail(profile.email);
        if (profile.phone) setPhone(profile.phone);
        if (profile.headline) setHeadline(profile.headline);
        if (profile.location) setLocation(profile.location);
        if (profile.summary) setSummary(profile.summary);
        if (profile.tags && profile.tags.length > 0) setSkills(profile.tags);
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);

        // 3. Fetch Education History
        try {
          const { data: eduList } = await supabase
            .schema("candidate")
            .from("education")
            .select("id, institution, degree, field_of_study, start_date, end_date, is_current")
            .eq("candidate_id", profile.id)
            .order("start_date", { ascending: false });
          if (eduList) setEducation(eduList);
        } catch {}

        // 4. Fetch Experience Logs
        try {
          const { data: expList } = await supabase
            .schema("candidate")
            .from("experience")
            .select("id, company_name, job_title, description, start_date, end_date, is_current")
            .eq("candidate_id", profile.id)
            .order("start_date", { ascending: false });
          if (expList) setExperience(expList);
        } catch {}

        // 5. Fetch Latest Parsed Resume
        try {
          const { data: latestRes } = await supabase
            .schema("candidate")
            .from("resumes")
            .select("parsed_text")
            .eq("candidate_id", profile.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestRes?.parsed_text) {
            setParsedResume(JSON.parse(latestRes.parsed_text));
          }
        } catch {}
      }
    } catch (err) {
      logger.error("Failed to load profile details", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    fetchProfileDetails();
  }, [fetchProfileDetails]);

  // Skill Input Autocomplete Logic
  React.useEffect(() => {
    if (!newSkill.trim()) {
      setFilteredSuggestions([]);
      return;
    }
    const query = newSkill.toLowerCase();
    const matches = SKILLS_POOL.filter(
      (s) => s.toLowerCase().includes(query) && !skills.includes(s)
    ).slice(0, 5);
    setFilteredSuggestions(matches);
  }, [newSkill, skills]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setSaving(false);
        return;
      }

      // 1. Save to Local Backup Storage
      const localKey = `smarthire_candidate_profile_${authUser.id}`;
      const localData = {
        firstName,
        lastName,
        email,
        phone,
        headline,
        location,
        summary,
        skills,
        avatarUrl,
      };
      try {
        localStorage.setItem(localKey, JSON.stringify(localData));
      } catch {}

      // 2. Ensure candidate row exists in DB
      let activeCandId = candId;
      if (!activeCandId) {
        const { data: existing } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (existing) {
          activeCandId = existing.id;
          setCandId(existing.id);
        } else {
          const { data: created } = await supabase
            .schema("candidate")
            .from("candidates")
            .insert({
              user_id: authUser.id,
              email: authUser.email || email,
              first_name: firstName,
              last_name: lastName,
              phone,
              headline,
              location,
              summary,
              tags: skills,
              avatar_url: avatarUrl,
            })
            .select("id")
            .maybeSingle();

          if (created) {
            activeCandId = created.id;
            setCandId(created.id);
          }
        }
      }

      // 3. Update DB if activeCandId exists
      if (activeCandId) {
        await supabase
          .schema("candidate")
          .from("candidates")
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            headline,
            location,
            summary,
            tags: skills,
            avatar_url: avatarUrl,
          })
          .eq("id", activeCandId);
      }

      // 4. Sync User metadata
      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      }).catch(() => {});

      logger.info(`Profile updated successfully for candidate ${activeCandId || authUser.id}`);
      window.location.reload();
    } catch (err) {
      logger.error("Error saving candidate profile", err);
    } finally {
      setSaving(false);
    }
  };

  // Skills handlers
  const handleAddSkillText = (skillText: string) => {
    const trimmed = skillText.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills([...skills, trimmed]);
    setNewSkill("");
    setShowSuggestions(false);
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  // Education CRUD handlers
  const handleAddEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candId || !eduInstitution || !eduDegree || !eduStart) return;

    try {
      const { data, error } = await supabase
        .schema("candidate")
        .from("education")
        .insert({
          candidate_id: candId,
          institution: eduInstitution,
          degree: eduDegree,
          field_of_study: eduField || null,
          start_date: eduStart,
          end_date: eduIsCurrent ? null : eduEnd || null,
          is_current: eduIsCurrent,
        })
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setEducation([data[0], ...education]);
      }

      // Reset Form
      setEduInstitution("");
      setEduDegree("");
      setEduField("");
      setEduStart("");
      setEduEnd("");
      setEduIsCurrent(false);
      setShowEduForm(false);
    } catch (err) {
      logger.error("Failed to add education record", err);
    }
  };

  const handleDeleteEducation = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("candidate")
        .from("education")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setEducation(education.filter((edu) => edu.id !== id));
    } catch (err) {
      logger.error("Failed to delete education record", err);
    }
  };

  // Experience CRUD handlers
  const handleAddExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candId || !expCompanyName || !expRole || !expStart) return;

    try {
      const { data, error } = await supabase
        .schema("candidate")
        .from("experience")
        .insert({
          candidate_id: candId,
          company_name: expCompanyName,
          job_title: expRole,
          description: expDesc || null,
          start_date: expStart,
          end_date: expIsCurrent ? null : expEnd || null,
          is_current: expIsCurrent,
        })
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setExperience([data[0], ...experience]);
      }

      // Reset Form
      setExpCompanyName("");
      setExpRole("");
      setExpDesc("");
      setExpStart("");
      setExpEnd("");
      setExpIsCurrent(false);
      setShowExpForm(false);
    } catch (err) {
      logger.error("Failed to add experience record", err);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("candidate")
        .from("experience")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setExperience(experience.filter((exp) => exp.id !== id));
    } catch (err) {
      logger.error("Failed to delete experience record", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">
          Candidate Portal
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
          Your Profile Specifications
        </h1>
        <p className="text-sm text-zinc-800 mt-1">
          Manage your personal identifiers, experiences timeline, education credentials, and tech skills.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Info Form */}
        <form onSubmit={handleSaveProfile} className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
              Personal Information & Profile Specs
            </h3>

            {/* Profile Photo Uploader */}
            <div className="flex items-center gap-5 p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 shadow-inner">
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Candidate Avatar"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500/30 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
                    {firstName ? firstName.charAt(0).toUpperCase() : "C"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all cursor-pointer"
                  title="Upload Profile Picture"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1 text-left">
                <h4 className="text-xs font-extrabold text-zinc-900">Candidate Profile Picture</h4>
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                  JPG, PNG or WEBP format. Rendered on recruiter ATS scorecards and candidate pipeline boards.
                </p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) setAvatarUrl(ev.target.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer pt-1"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload Profile Image
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Email Address (Read-only)</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +1 (555) 019-2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Professional Headline</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Engineer | React specialist"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Location</label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider block">Short Biography Summary</label>
                <textarea
                  rows={4}
                  placeholder="Tell recruiters about your background, career focus, and major achievements..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 h-10 px-6 font-bold rounded-lg shadow-sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    Save Profile Metadata <Save className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Technical Skills Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div ref={autocompleteRef} className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm relative">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2 flex items-center gap-1.5">
              <Code className="h-4.5 w-4.5 text-blue-500" /> Technical Skills
            </h3>

            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type to search skills..."
                  value={newSkill}
                  onChange={(e) => {
                    setNewSkill(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleAddSkillText(newSkill)}
                  disabled={!newSkill.trim()}
                  className="h-8 w-8 flex items-center justify-center bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-850 rounded-lg disabled:opacity-50 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Autocomplete Suggestions Box */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  {filteredSuggestions.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => handleAddSkillText(skill)}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-850 hover:bg-zinc-50 hover:text-blue-600 transition-colors font-medium border-b border-zinc-50 last:border-0"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 bg-blue-50/10 border border-blue-50/20 text-blue-600 px-2 py-0.5 rounded text-xs font-semibold"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-blue-600 hover:text-red-500 font-bold ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}

              {skills.length === 0 && (
                <p className="text-xs text-zinc-750 italic">No skills added.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Academic Education History */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-2 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="h-4.5 w-4.5 text-blue-500" /> Academic Education History
          </h3>
          <button
            type="button"
            onClick={() => setShowEduForm(!showEduForm)}
            className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Log New Education
          </button>
        </div>

        {/* Inline Add Education Form */}
        {showEduForm && (
          <form onSubmit={handleAddEducation} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">New Education details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Institution / University *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stanford University"
                  value={eduInstitution}
                  onChange={(e) => setEduInstitution(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 placeholder-zinc-400 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Degree / Qualification *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bachelor of Science"
                  value={eduDegree}
                  onChange={(e) => setEduDegree(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 placeholder-zinc-400 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Field of Study</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={eduField}
                  onChange={(e) => setEduField(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 placeholder-zinc-400 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Start Date *</label>
                <input
                  type="date"
                  required
                  value={eduStart}
                  onChange={(e) => setEduStart(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">End Date</label>
                <input
                  type="date"
                  disabled={eduIsCurrent}
                  value={eduEnd}
                  onChange={(e) => setEduEnd(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus:border-blue-500 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="eduIsCurrent"
                  checked={eduIsCurrent}
                  onChange={(e) => setEduIsCurrent(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-0"
                />
                <label htmlFor="eduIsCurrent" className="font-bold text-zinc-800 cursor-pointer">I am currently studying here</label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                onClick={() => setShowEduForm(false)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 px-4 h-9 text-xs font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 text-xs font-bold rounded-lg shadow-sm"
              >
                Log Education
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {education.map((edu) => (
            <div
              key={edu.id}
              className="flex items-center justify-between p-3.5 bg-zinc-550/5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
            >
              <div>
                <h4 className="font-bold text-zinc-900">{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ""}</h4>
                <p className="text-zinc-850 font-bold mt-0.5">{edu.institution}</p>
                <p className="text-[10px] text-zinc-700 mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(edu.start_date).toLocaleDateString()} –{" "}
                    {edu.is_current ? "Present" : edu.end_date ? new Date(edu.end_date).toLocaleDateString() : ""}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => edu.id && handleDeleteEducation(edu.id)}
                className="text-zinc-700 hover:text-red-500 p-1 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {education.length === 0 && (
            <p className="text-xs text-zinc-700 italic">No academic degrees logged yet.</p>
          )}
        </div>
      </div>

      {/* Experience Records */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-2 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="h-4.5 w-4.5 text-blue-500" /> Professional Experience logs
          </h3>
          <button
            type="button"
            onClick={() => setShowExpForm(!showExpForm)}
            className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Log New Experience
          </button>
        </div>

        {/* Inline Add Experience Form */}
        {showExpForm && (
          <form onSubmit={handleAddExperience} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">New Job Experience details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google LLC"
                  value={expCompanyName}
                  onChange={(e) => setExpCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 placeholder-zinc-400 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Position / Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={expRole}
                  onChange={(e) => setExpRole(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 placeholder-zinc-400 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="font-bold text-zinc-800">Job Description</label>
                <textarea
                  rows={3}
                  placeholder="Summarize your key responsibilities, tools utilized, and metrics achieved..."
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 placeholder-zinc-400 text-zinc-900 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-800">Start Date *</label>
                <input
                  type="date"
                  required
                  value={expStart}
                  onChange={(e) => setExpStart(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-zinc-800">End Date</label>
                <input
                  type="date"
                  disabled={expIsCurrent}
                  value={expEnd}
                  onChange={(e) => setExpEnd(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus:border-blue-500 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2 pt-1 col-span-2">
                <input
                  type="checkbox"
                  id="expIsCurrent"
                  checked={expIsCurrent}
                  onChange={(e) => setExpIsCurrent(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-0"
                />
                <label htmlFor="expIsCurrent" className="font-bold text-zinc-800 cursor-pointer">I am currently working here</label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                onClick={() => setShowExpForm(false)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 px-4 h-9 text-xs font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 text-xs font-bold rounded-lg shadow-sm"
              >
                Log Experience
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {experience.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
            >
              <div className="space-y-1">
                <h4 className="font-bold text-zinc-900">{exp.job_title}</h4>
                <p className="text-zinc-850 font-bold">{exp.company_name}</p>
                {exp.description && (
                  <p className="text-zinc-700 leading-relaxed max-w-xl">{exp.description}</p>
                )}
                <p className="text-[10px] text-zinc-700 mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(exp.start_date).toLocaleDateString()} –{" "}
                    {exp.is_current ? "Present" : exp.end_date ? new Date(exp.end_date).toLocaleDateString() : ""}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => exp.id && handleDeleteExperience(exp.id)}
                className="text-zinc-700 hover:text-red-500 p-1 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg shadow-sm shrink-0 self-start"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {experience.length === 0 && (
            <p className="text-xs text-zinc-700 italic">No professional roles logged yet.</p>
          )}
        </div>
      </div>

      {/* Parsed Resume Information (Read-only) */}
      {parsedResume && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2 flex items-center gap-2">
            <Briefcase className="h-4.5 w-4.5 text-green-600" /> Parsed Resume Information (Read-only)
          </h3>
          <p className="text-[10px] text-zinc-800 font-semibold bg-green-50 text-green-700 px-2 py-1 rounded inline-block">
            Auto-extracted from: {parsedResume.fileName} (Parsed on {new Date(parsedResume.parsedAt).toLocaleString()})
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-800">
            {/* Contact Details */}
            <div className="space-y-2 bg-zinc-50 p-4 rounded-xl border border-zinc-150">
              <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[10px]">Contact Info</h4>
              <p><strong>Full Name:</strong> {parsedResume.personalInfo?.fullName}</p>
              <p><strong>Email:</strong> {parsedResume.personalInfo?.email}</p>
              <p><strong>Phone:</strong> {parsedResume.personalInfo?.phone}</p>
              <p><strong>Location:</strong> {parsedResume.personalInfo?.location}</p>
            </div>

            {/* Profile Summary */}
            <div className="space-y-2 bg-zinc-50 p-4 rounded-xl border border-zinc-150">
              <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[10px]">Parsed Career Summary</h4>
              <p className="leading-relaxed">{parsedResume.summary}</p>
            </div>

            {/* Parsed Skills */}
            <div className="space-y-2 bg-zinc-50 p-4 rounded-xl border border-zinc-150 md:col-span-2">
              <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[10px]">Parsed Technical Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {parsedResume.skills?.map((s: string) => (
                  <span key={s} className="bg-zinc-200 text-zinc-900 px-2 py-0.5 rounded text-[10px] font-bold">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Parsed Experience */}
            <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-150 md:col-span-2">
              <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[10px]">Parsed Work History</h4>
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {parsedResume.experience?.map((exp: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-zinc-300 pl-3">
                    <p className="font-bold text-zinc-900">{exp.role} @ {exp.company}</p>
                    <p className="text-[10px] text-zinc-700 font-semibold">{exp.duration}</p>
                    <p className="mt-1 leading-relaxed">{exp.highlights}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Parsed Education */}
            <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-150 md:col-span-2">
              <h4 className="font-bold text-zinc-900 uppercase tracking-wider text-[10px]">Parsed Education</h4>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {parsedResume.education?.map((edu: any, idx: number) => (
                  <div key={idx} className="border-l-2 border-zinc-300 pl-3">
                    <p className="font-bold text-zinc-900">{edu.degree}</p>
                    <p className="text-[10px] text-zinc-700 font-semibold">{edu.institution} ({edu.year})</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
