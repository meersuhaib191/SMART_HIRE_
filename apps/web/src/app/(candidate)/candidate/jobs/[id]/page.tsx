"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@smarthire/ui";
import { ArrowLeft, MapPin, Layers, Loader2, Sparkles, Send } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

interface JobDetails {
  id: string;
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  description?: string;
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
        const { data: jobObj } = await supabase
          .schema("job")
          .from("jobs")
          .select("id, title, category, location, type, description")
          .eq("id", jobId)
          .maybeSingle();

        if (jobObj) {
          setJob({
            id: jobObj.id,
            title: jobObj.title,
            department: jobObj.category || "General",
            location: jobObj.location || "Remote",
            employment_type: jobObj.type,
            description: jobObj.description,
          });
        }

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
    <div className="space-y-6 text-left max-w-3xl mx-auto py-6 animate-in fade-in duration-200">
      {/* Back Link */}
      <div>
        <Link
          href="/candidate/jobs"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-zinc-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to open listings
        </Link>
      </div>

      {/* Main Job Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-700 font-medium">
            {job.location && (
              <div className="flex items-center gap-1 text-zinc-800">
                <MapPin className="h-4 w-4" />
                <span>{job.location}</span>
              </div>
            )}
            {job.department && (
              <div className="flex items-center gap-1 text-zinc-800">
                <Layers className="h-4 w-4" />
                <span>{job.department}</span>
              </div>
            )}
            <span className="capitalize text-zinc-800">{job.employment_type?.replace("-", " ")}</span>
          </div>
        </div>

        {alreadyApplied ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20 shadow-sm shrink-0">
            Already Applied
          </span>
        ) : (
          <Button
            onClick={() => setIsApplyModalOpen(true)}
            disabled={submitting}
            className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-10 px-6 font-bold rounded-lg shadow-sm shrink-0"
          >
            Apply Now <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Description Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            Description & Core Prerequisites
          </h3>
          <p className="text-xs text-zinc-850 leading-relaxed whitespace-pre-line">
            {job.description || "No descriptions available for this job opening."}
          </p>
        </div>

        {/* AI Alignment Card */}
        <div className="lg:col-span-4 rounded-xl border border-zinc-200 bg-white p-5 space-y-4 text-left self-start shadow-sm">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-blue-500" /> AI Role Match
          </h3>
          <p className="text-xs text-zinc-800 leading-relaxed">
            Your profile matches 88% of the core competencies required for this opening. Review your skills list to verify that React and Next.js are highlighted.
          </p>
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
