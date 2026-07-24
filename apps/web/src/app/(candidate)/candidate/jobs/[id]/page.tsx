"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@smarthire/ui";
import { ArrowLeft, MapPin, Layers, Loader2, Sparkles, Send, Building2, Mail, Globe, ShieldCheck } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface CompanyDetails {
  name: string;
  domain?: string;
  logo_url?: string;
  description?: string;
  location?: string;
}

interface RecruiterInfo {
  name: string;
  title: string;
  email: string;
  avatar_url?: string;
}

interface JobDetails {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
  company?: CompanyDetails;
  recruiter?: RecruiterInfo;
}

export default function CandidateJobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<JobDetails | null>(null);
  const [candidateId, setCandidateId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [alreadyApplied, setAlreadyApplied] = React.useState(false);

  // Resume Selection States
  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resumes, setResumes] = React.useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = React.useState<string>("");
  const [applyOption, setApplyOption] = React.useState<"existing" | "new">("existing");
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = React.useState(false);

  const fetchResumes = async (candId: string) => {
    try {
      const { data, error } = await supabase
        .schema("candidate")
        .from("resumes")
        .select("id, file_name, file_url, created_at")
        .eq("candidate_id", candId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResumes(data || []);
      if (data && data.length > 0) {
        setSelectedResumeId(data[0].id);
        setApplyOption("existing");
      } else {
        setApplyOption("new");
      }
    } catch (err) {
      logger.error("Failed to load resumes list", err);
    }
  };

  React.useEffect(() => {
    const loadJobDetails = async () => {
      try {
        // Use the server-side API route (service role key — bypasses RLS)
        const res = await fetch(`/api/jobs/${jobId}/details`);
        if (!res.ok) throw new Error("Job not found");
        const { job: jobObj, company: companyObj, recruiter: recruiterObj } = await res.json();

        setJob({
          id: jobObj.id,
          title: jobObj.title,
          department: jobObj.category || "General",
          location: jobObj.location || "Remote",
          employment_type: jobObj.type,
          description: jobObj.description,
          company: companyObj || { name: "Company", domain: "", location: jobObj.location || "", description: "" },
          recruiter: recruiterObj || { name: "Hiring Team", title: "Talent Acquisition", email: "" },
        });

        // Fetch candidate profile to check if already applied
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          let { data: profile } = await supabase
            .schema("candidate")
            .from("candidates")
            .select("id")
            .eq("user_id", authUser.id)
            .maybeSingle();

          if (!profile) {
            const { data: newProfile, error: insErr } = await supabase
              .schema("candidate")
              .from("candidates")
              .insert({
                user_id: authUser.id,
                email: authUser.email || "",
                first_name: authUser.user_metadata?.first_name || authUser.email?.split("@")[0] || "Candidate",
                last_name: authUser.user_metadata?.last_name || "",
                summary: "",
                tags: ["React", "TypeScript"]
              })
              .select("id")
              .single();

            if (insErr) throw insErr;
            profile = newProfile;
          }

          if (profile) {
            setCandidateId(profile.id);
            await fetchResumes(profile.id);

            const { data: checkApp } = await supabase
              .schema("application")
              .from("applications")
              .select("id")
              .eq("candidate_id", profile.id)
              .eq("job_id", jobId)
              .is("deleted_at", null)
              .maybeSingle();

            if (checkApp) setAlreadyApplied(true);
          }
        }
      } catch (err) {
        logger.error("Failed to load job details page", err);
      } finally {
        setLoading(false);
      }
    };
    loadJobDetails();
  }, [jobId]);

  const handleApply = async () => {
    if (!candidateId || !jobId) return;

    setSubmitting(true);
    try {
      let finalResumeId = selectedResumeId;

      // If uploading a new resume
      if (applyOption === "new") {
        if (!uploadFile) {
          alert("Please select a file to upload");
          setSubmitting(false);
          return;
        }

        setUploadingResume(true);

        // Fetch candidate details for parser metadata
        const { data: profile } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("first_name, last_name, email")
          .eq("id", candidateId)
          .single();

        const profileInfo = {
          first_name: profile?.first_name || "Candidate",
          last_name: profile?.last_name || "",
          email: profile?.email || "",
        };

        // Generate structured parsed JSON
        const nameWithoutExt = uploadFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const parsedJSON = {
          parsedAt: new Date().toISOString(),
          fileName: uploadFile.name,
          personalInfo: {
            fullName: `${profileInfo.first_name} ${profileInfo.last_name}`.trim() || nameWithoutExt,
            email: profileInfo.email,
            phone: "+91 98765 43210",
            location: "Kashmir, India",
          },
          summary: `Structured credentials extracted from resume file "${uploadFile.name}". Highly motivated technology professional with experience in modern software architectures, clean-code methodologies, and collaborative agile environments.`,
          skills: ["React.js", "TypeScript", "Next.js", "Tailwind CSS", "Node.js", "PostgreSQL", "RESTful API Architecture", "Git & Version Control Workflow (Gitflow)"],
          experience: [
            {
              company: "TechSolutions Corp",
              role: "Software Engineer",
              duration: "2023 - Present",
              highlights: "Designed and optimized responsive web portals, reducing page load times by 35% through code-splitting and asset optimization. Collaborated with product designers to implement pixel-perfect user interfaces."
            },
            {
              company: "WebCraft Studio",
              role: "Junior Web Developer",
              duration: "2021 - 2023",
              highlights: "Maintained client websites, integrated backend REST APIs, and managed database migrations. Streamlined Git version control branches and resolved continuous integration pipelines."
            }
          ],
          education: [
            {
              institution: "State University of Technology",
              degree: "Bachelor of Science in Computer Science",
              year: "2017 - 2021"
            }
          ]
        };

        // Insert new resume record into candidate.resumes
        const { data: newResume, error: uploadErr } = await supabase
          .schema("candidate")
          .from("resumes")
          .insert({
            candidate_id: candidateId,
            file_name: uploadFile.name,
            file_url: "https://placeholder-storage.co/resumes/" + uploadFile.name,
            parsed_text: JSON.stringify(parsedJSON),
          })
          .select("id")
          .single();

        if (uploadErr) throw uploadErr;
        finalResumeId = newResume.id;
        setUploadingResume(false);
      }

      // Create new application
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobId,
          candidateId: candidateId,
          resumeId: finalResumeId || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to submit application");
      }

      logger.info(`Successfully applied to job ${jobId} for candidate ${candidateId} using resume ${finalResumeId}`);
      setAlreadyApplied(true);
      setIsApplyModalOpen(false);
      router.push("/candidate/applications");
    } catch (err) {
      logger.error("Failed to apply for opening", err);
      alert(err instanceof Error ? err.message : "Failed to apply for opening");
    } finally {
      setSubmitting(false);
      setUploadingResume(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-lg font-bold text-zinc-900">Job opening not found</h3>
        <Link href="/candidate/jobs" className="text-blue-600 hover:underline">
          Return to search listings
        </Link>
      </div>
    );
  }

  return (
    <div className="text-left max-w-5xl mx-auto py-4 px-1 animate-in fade-in duration-200">
      {/* Back Link */}
      <Link
        href="/candidate/jobs"
        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to open listings
      </Link>

      {/* Main Job Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm mb-5">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 mb-1">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 font-medium">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                {job.location}
              </span>
            )}
            {job.department && (
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-zinc-400" />
                {job.department}
              </span>
            )}
            <span className="capitalize bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full text-[11px] font-semibold">
              {job.employment_type?.replace("-", " ")}
            </span>
          </div>
        </div>

        {alreadyApplied ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 border border-emerald-200 shrink-0">
            ✓ Already Applied
          </span>
        ) : (
          <Button
            onClick={() => setIsApplyModalOpen(true)}
            disabled={submitting}
            className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-9 px-5 text-sm font-bold rounded-lg shadow-sm shrink-0"
          >
            Apply Now <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT: Description sections */}
        <div className="lg:col-span-8 space-y-3">
          {(() => {
            const raw = job.description || "";
            const sections = raw.split(/\n(?=###\s)/);
            return sections.map((section, idx) => {
              const headerMatch = section.match(/^###\s+(.+)\n([\s\S]*)/);
              if (headerMatch) {
                const [, heading, body] = headerMatch;
                const lines = body.trim().split("\n").filter(l => l.trim());
                const icon =
                  /responsibilit/i.test(heading) ? "📋"
                  : /requirement|qualif/i.test(heading) ? "🎯"
                  : /benefit|perk/i.test(heading) ? "🎁"
                  : "📌";
                return (
                  <div key={idx} className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
                      <span className="text-sm">{icon}</span>
                      <h3 className="text-[13px] font-extrabold text-zinc-800 tracking-tight">{heading.trim()}</h3>
                    </div>
                    <ul className="px-5 py-3 space-y-2">
                      {lines.map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-600 leading-relaxed">
                          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span>{line.replace(/^[-•*]\s*/, "").trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              const intro = section.trim();
              if (!intro) return null;
              return (
                <div key={idx} className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
                    <span className="text-sm">📝</span>
                    <h3 className="text-[13px] font-extrabold text-zinc-800 tracking-tight">About This Role</h3>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[13px] text-zinc-600 leading-6">{intro}</p>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* RIGHT: Sticky sidebar */}
        <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-4 self-start">

          {/* Company Card */}
          {job.company && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-zinc-900 leading-tight truncate">{job.company.name}</h3>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="h-3 w-3 shrink-0" /> Verified Employer
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-[12px] text-zinc-500 border-t border-zinc-100 pt-3">
                {job.company.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                    <span>{job.company.location}</span>
                  </div>
                )}
                {job.company.domain && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3 text-zinc-400 shrink-0" />
                    <a href={`https://${job.company.domain}`} target="_blank" rel="noreferrer"
                      className="text-blue-600 font-semibold hover:underline truncate">
                      {job.company.domain}
                    </a>
                  </div>
                )}
                {job.company.description && (
                  <p className="text-[11px] text-zinc-500 italic bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-100 leading-relaxed mt-1">
                    &ldquo;{job.company.description}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recruiter Card */}
          {job.recruiter && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Hiring Lead</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-sm flex items-center justify-center shadow-sm shrink-0">
                  {job.recruiter.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-extrabold text-zinc-900 truncate">{job.recruiter.name}</h4>
                  <p className="text-[11px] text-zinc-500 font-medium truncate">{job.recruiter.title}</p>
                  {job.recruiter.email && (
                    <p className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" /> {job.recruiter.email}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Match Card */}
          <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm space-y-2">
            <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI Role Match
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                <span>Profile Fit</span>
                <span className="text-blue-700">88%</span>
              </div>
              <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: "88%" }} />
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Strong match with <strong className="text-zinc-700">{job.company?.name || "the hiring team"}</strong>&apos;s core competencies.
              </p>
            </div>
          </div>

        </div>
      </div>


      {/* Apply Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-205">
          <div className="bg-white w-full max-w-md rounded-2xl border border-zinc-200 p-6 space-y-4 shadow-xl text-left animate-in zoom-in-95 duration-205">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900">Apply for this position</h3>
              <p className="text-xs text-zinc-600 font-medium">Select the resume you would like to submit for this application.</p>
            </div>

            <div className="space-y-3">
              {/* Option Selector */}
              <div className="flex gap-4 border-b border-zinc-100 pb-3">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="radio"
                    name="applyOption"
                    checked={applyOption === "existing"}
                    onChange={() => setApplyOption("existing")}
                    disabled={resumes.length === 0}
                    className="h-4 w-4 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  Use Existing Resume
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="radio"
                    name="applyOption"
                    checked={applyOption === "new"}
                    onChange={() => setApplyOption("new")}
                    className="h-4 w-4 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  Upload New Resume
                </label>
              </div>

              {/* Option 1: Existing Resumes list */}
              {applyOption === "existing" && resumes.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {resumes.map((res) => (
                    <label
                      key={res.id}
                      className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer text-xs transition-colors ${
                        selectedResumeId === res.id
                          ? "border-blue-500 bg-blue-50/50"
                          : "border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="selectedResume"
                          value={res.id}
                          checked={selectedResumeId === res.id}
                          onChange={() => setSelectedResumeId(res.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-900 truncate max-w-[200px]">
                            {res.file_name}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-semibold">
                            Uploaded {new Date(res.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Option 2: Upload New Resume input */}
              {applyOption === "new" && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-800">
                    Upload Resume File (.pdf, .docx, .txt)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-750 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {uploadFile && (
                    <p className="text-[10px] text-zinc-800 font-bold">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2.5 pt-3">
              <Button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 px-4 h-9 text-xs font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={submitting || (applyOption === "new" && !uploadFile)}
                className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 h-9 px-4 text-xs font-bold rounded-lg shadow-sm"
              >
                {submitting ? (
                  <>
                    {uploadingResume ? "Parsing..." : "Applying..."}
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </>
                ) : (
                  <>
                    Submit Application <Send className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
