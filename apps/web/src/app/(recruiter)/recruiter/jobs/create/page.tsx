"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FormField } from "@/components/auth";
import { Button } from "@smarthire/ui";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Check, Briefcase } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

// Supabase Client
const supabase = createBrowserClient(REAL_URL, REAL_KEY);

const jobWizardSchema = z.object({
  // Step 1
  title: z.string().min(1, "Job title is required").max(255),
  departmentId: z.string().uuid("Invalid department").or(z.literal("")).nullable().optional(),
  type: z.enum(["full-time", "part-time", "contract", "internship"]),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]),
  location: z.string().min(1, "Location description is required").max(150),
  remotePolicy: z.enum(["remote", "hybrid", "onsite"]),

  // Step 2
  description: z.string().min(1, "Job description content is required"),
  responsibilities: z.string().optional(),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  category: z.string().max(100).nullable().optional(),

  // Step 3
  recruiterId: z.string().optional(),
  mcqAssessmentId: z.string().uuid("Invalid MCQ bank").or(z.literal("")).nullable().optional(),
  codingAssessmentId: z.string().uuid("Invalid coding bank").or(z.literal("")).nullable().optional(),

  status: z.enum(["draft", "published", "closed"]),
});

type JobWizardValues = z.infer<typeof jobWizardSchema>;

const LOCAL_STORAGE_KEY = "smarthire_create_job_wizard";

export default function CreateJobPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Database Option States
  const [companyId, setCompanyId] = React.useState<string | null>(null);

  // Form setup
  const [initialValues, setInitialValues] = React.useState<JobWizardValues>({
    title: "",
    departmentId: null,
    type: "full-time",
    experienceLevel: "mid",
    location: "Remote",
    remotePolicy: "remote",
    description: "",
    responsibilities: "",
    requirements: "",
    benefits: "",
    category: "Software Engineering",
    recruiterId: "",
    mcqAssessmentId: null,
    codingAssessmentId: null,
    status: "draft",
  });

  const {
    register,
    handleSubmit,
    setValue,
    control,
    trigger,
    formState: { errors },
  } = useForm<JobWizardValues>({
    resolver: zodResolver(jobWizardSchema),
    values: initialValues,
  });

  const watchedValues = useWatch({ control });

  // Load options & user details on mount
  React.useEffect(() => {
    const loadWizardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch recruiter record to find company ID
        const { data: recruiter } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("company_id, id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        let activeCompanyId = recruiter?.company_id;
        let activeRecruiterId = recruiter?.id;

        if (!recruiter || !recruiter.company_id) {
          const savedProfileKey = `smarthire_active_recruiter_profile_${user.id}`;
          const savedProfile = localStorage.getItem(savedProfileKey) || localStorage.getItem("smarthire_active_recruiter_profile");
          let compName = "";
          let compDomain = "";
          let compIndustry = "Technology";

          if (savedProfile) {
            try {
              const parsed = JSON.parse(savedProfile);
              if (parsed.companyName) compName = parsed.companyName;
              if (parsed.companyDomain) compDomain = parsed.companyDomain;
              if (parsed.companyIndustry) compIndustry = parsed.companyIndustry;
            } catch (e) {
              logger.error("Failed to parse saved specs for job wizard", e);
            }
          }

          if (compName) {
            const { data: newComp } = await supabase
              .schema("organization")
              .from("companies")
              .insert({
                name: compName,
                domain: compDomain || null,
                industry: compIndustry || null,
              })
              .select("id")
              .single();

            if (newComp) {
              activeCompanyId = newComp.id;
              const { data: newRec } = await supabase
                .schema("organization")
                .from("recruiters")
                .upsert({
                  user_id: user.id,
                  company_id: newComp.id,
                  role: "recruiter",
                }, { onConflict: "user_id" })
                .select("id")
                .single();

              if (newRec) {
                activeRecruiterId = newRec.id;
              }
            }
          } else {
            router.push("/recruiter/profile");
            return;
          }
        }

        if (activeCompanyId && activeRecruiterId) {
          setCompanyId(activeCompanyId);
          setValue("recruiterId", activeRecruiterId);
        }
      } catch (err) {
        logger.error("Failed to load options for Job Wizard", err);
      }
    };

    loadWizardData();
  }, [setValue, router]);

  // Autosave to localStorage on changes
  React.useEffect(() => {
    if (watchedValues && Object.keys(watchedValues).length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(watchedValues));
    }
  }, [watchedValues]);

  // Load from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInitialValues((prev) => ({ ...prev, ...parsed }));
      } catch (err) {
        logger.error("Failed to parse wizard autosave values", err);
      }
    }
  }, []);

  const handleNextStep = async () => {
    let isValid = false;
    if (activeStep === 1) {
      isValid = await trigger(["title", "type", "experienceLevel", "location", "remotePolicy"]);
    } else if (activeStep === 2) {
      isValid = await trigger(["description", "responsibilities", "requirements", "benefits", "category"]);
    }

    if (isValid) {
      setErrorMsg(null);
      setActiveStep((prev) => prev + 1);
    } else {
      setErrorMsg("Please correct form errors before continuing.");
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setActiveStep((prev) => prev - 1);
  };

  const onSubmit = async (values: JobWizardValues) => {
    if (!companyId) return;
    logger.info(`[CreateJobPage] Registering job: ${values.title}`);
    setLoading(true);
    setErrorMsg(null);

    // Merge rich text text areas for PostgreSQL description column
    const fullDescription = `
      ${values.description}
      ${values.responsibilities ? `\n\n### Responsibilities\n${values.responsibilities}` : ""}
      ${values.requirements ? `\n\n### Requirements\n${values.requirements}` : ""}
      ${values.benefits ? `\n\n### Benefits\n${values.benefits}` : ""}
    `.trim();

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          recruiterId: values.recruiterId || undefined,
          title: values.title,
          description: fullDescription,
          location: values.location,
          type: values.type,
          status: values.status,
          experienceLevel: values.experienceLevel,
          category: values.category || null,
          benefits: values.benefits ? values.benefits.split("\n") : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Failed to create job posting");
      }

      logger.info("[CreateJobPage] Job created successfully");
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      router.push("/recruiter/jobs");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Creation failed. Please check inputs.";
      setErrorMsg(message);
      logger.error("[CreateJobPage] Error creating job posting", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Briefcase className="h-4 w-4" /> Recruiter Management
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
            Create Job Posting
          </h1>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Publish a new position to start collecting and evaluating engineering candidates.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/recruiter/jobs")}
          className="text-xs font-semibold self-start sm:self-auto gap-1.5 border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Jobs
        </Button>
      </div>

      {/* Main Container Card (Crisp White Light Theme) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Wizard Stepper Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-5 mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/20">
              {activeStep}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Step {activeStep} of 3
              </div>
              <div className="text-base font-bold text-zinc-900">
                {activeStep === 1
                  ? "Basic Job Details"
                  : activeStep === 2
                  ? "Description & Requirements"
                  : "Publishing Status"}
              </div>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step === activeStep
                    ? "w-8 bg-blue-600"
                    : step < activeStep
                    ? "w-2 bg-emerald-500"
                    : "w-2 bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-600">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: BASIC INFORMATION */}
          {activeStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
              <FormField
                label="Job Title"
                id="title"
                placeholder="e.g. Lead Software Engineer"
                error={errors.title?.message}
                disabled={loading}
                {...register("title")}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="space-y-1.5 w-full sm:col-span-2">
                  <label htmlFor="type" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Employment Type
                  </label>
                  <select
                    id="type"
                    disabled={loading}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors font-medium"
                    {...register("type")}
                  >
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="space-y-1.5 w-full">
                  <label htmlFor="experienceLevel" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Experience Level
                  </label>
                  <select
                    id="experienceLevel"
                    disabled={loading}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors font-medium"
                    {...register("experienceLevel")}
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="lead">Lead Role</option>
                    <option value="executive">Executive Level</option>
                  </select>
                </div>

                <div className="space-y-1.5 w-full">
                  <label htmlFor="remotePolicy" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Remote Policy
                  </label>
                  <select
                    id="remotePolicy"
                    disabled={loading}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors font-medium"
                    {...register("remotePolicy")}
                  >
                    <option value="remote">Fully Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">Onsite</option>
                  </select>
                </div>
              </div>

              <FormField
                label="Location"
                id="location"
                placeholder="e.g. San Francisco, CA or Remote"
                error={errors.location?.message}
                disabled={loading}
                {...register("location")}
              />
            </div>
          )}

          {/* STEP 2: JOB DESCRIPTION CONTENT */}
          {activeStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200 text-left">
              <div className="space-y-1.5 w-full text-left">
                <label htmlFor="category" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Job Domain & Industry Field *
                </label>
                <select
                  id="category"
                  disabled={loading}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors cursor-pointer font-medium"
                  {...register("category")}
                >
                  <option value="Technology & Software Engineering">Technology & Software Engineering (Coding Round Applicable)</option>
                  <option value="Finance & Accounting">Finance & Accounting (Non-Tech Role)</option>
                  <option value="Marketing & Sales">Marketing, Sales & Growth (Non-Tech Role)</option>
                  <option value="Human Resources">Human Resources & Talent (Non-Tech Role)</option>
                  <option value="Product Design & UI/UX">Product Design & Creative (Non-Tech Role)</option>
                  <option value="Legal & Compliance">Legal, Compliance & Policy (Non-Tech Role)</option>
                  <option value="Operations & Supply Chain">Operations & Supply Chain (Non-Tech Role)</option>
                  <option value="Healthcare & Life Sciences">Healthcare & Life Sciences (Non-Tech Role)</option>
                  <option value="Education & Training">Education & Training (Non-Tech Role)</option>
                  <option value="Customer Success & Support">Customer Success & Support (Non-Tech Role)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Job Overview (Rich Description)
                </label>
                <textarea
                  id="description"
                  rows={4}
                  placeholder="Describe the role, impact, and daily responsibilities..."
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm bg-white text-zinc-900 placeholder-zinc-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all duration-150 resize-none font-medium ${
                    errors.description ? "border-red-500 bg-red-50" : "border-zinc-300"
                  }`}
                  {...register("description")}
                />
                {errors.description?.message && (
                  <p className="text-xs font-semibold text-red-600 mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="responsibilities" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Responsibilities (One per line)
                </label>
                <textarea
                  id="responsibilities"
                  rows={3}
                  placeholder="Build robust React pages...&#10;Optimize Postgres schemas..."
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all duration-150 resize-none font-medium"
                  {...register("responsibilities")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="requirements" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Requirements
                  </label>
                  <textarea
                    id="requirements"
                    rows={3}
                    placeholder="3+ years React experience..."
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all duration-150 resize-none font-medium"
                    {...register("requirements")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="benefits" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Benefits
                  </label>
                  <textarea
                    id="benefits"
                    rows={3}
                    placeholder="Full health insurance..."
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all duration-150 resize-none font-medium"
                    {...register("benefits")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PUBLISHING STATE Choice */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200 text-left">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                  Posting Status Choice
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setValue("status", "draft")}
                    className={`flex flex-col items-center justify-center border rounded-2xl p-6 text-center cursor-pointer transition-all shadow-sm ${
                      watchedValues?.status === "draft"
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-500/20"
                        : "border-zinc-200 bg-white hover:border-blue-400"
                    }`}
                  >
                    <input
                      type="radio"
                      value="draft"
                      className="sr-only"
                      {...register("status")}
                      checked={watchedValues?.status === "draft"}
                    />
                    <span className="font-bold text-zinc-900 text-sm">Save as Draft</span>
                    <span className="text-xs text-zinc-500 mt-1.5 leading-relaxed max-w-[180px]">
                      Internal preview only. Candidate pipeline will not open.
                    </span>
                  </div>

                  <div
                    onClick={() => setValue("status", "published")}
                    className={`flex flex-col items-center justify-center border rounded-2xl p-6 text-center cursor-pointer transition-all shadow-sm ${
                      watchedValues?.status === "published"
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-500/20"
                        : "border-zinc-200 bg-white hover:border-blue-400"
                    }`}
                  >
                    <input
                      type="radio"
                      value="published"
                      className="sr-only"
                      {...register("status")}
                      checked={watchedValues?.status === "published"}
                    />
                    <span className="font-bold text-blue-600 text-sm flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> Publish Live
                    </span>
                    <span className="text-xs text-zinc-500 mt-1.5 leading-relaxed max-w-[180px]">
                      Publish opening immediately to candidate job directory.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Footer Controls */}
          <div className="flex justify-between items-center pt-6 border-t border-zinc-100 mt-6">
            {activeStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl h-10 px-4 text-xs font-semibold border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/recruiter/jobs")}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl h-10 px-4 text-xs font-semibold border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
              >
                Cancel
              </Button>
            )}

            {activeStep < 3 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 h-10 px-6 rounded-xl text-xs font-semibold transition-colors duration-150"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading || !companyId}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 h-10 px-6 rounded-xl text-xs font-semibold transition-colors duration-150"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    Complete & Save <Check className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
