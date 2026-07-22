"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthCard, FormField } from "@/components/auth";
import { Button } from "@smarthire/ui";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Check } from "lucide-react";
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
  recruiterId: z.string().uuid("Invalid recruiter lead"),
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
  const [departments, setDepartments] = React.useState<{ id: string; name: string }[]>([]);
  const [recruiters, setRecruiters] = React.useState<{ id: string; user: { first_name: string; last_name: string } }[]>([]);
  const [assessmentTemplates, setAssessmentTemplates] = React.useState<{ id: string; title: string; description?: string | null }[]>([]);

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

        if (!recruiter) {
          const { data: comp } = await supabase
            .schema("organization")
            .from("companies")
            .select("id")
            .limit(1)
            .maybeSingle();

          if (comp) {
            activeCompanyId = comp.id;
            const { data: newRec } = await supabase
              .schema("organization")
              .from("recruiters")
              .insert({
                user_id: user.id,
                company_id: comp.id,
                role: "recruiter",
              })
              .select("id")
              .single();

            if (newRec) {
              activeRecruiterId = newRec.id;
            }
          }
        }

        if (activeCompanyId && activeRecruiterId) {
          setCompanyId(activeCompanyId);
          setValue("recruiterId", activeRecruiterId);

          // Fetch departments
          const { data: depts } = await supabase
            .schema("organization")
            .from("departments")
            .select("id, name")
            .eq("company_id", activeCompanyId)
            .is("deleted_at", null);
          setDepartments(depts || []);

          // Fetch recruiters (separate queries to avoid cross-schema join)
          const { data: recList } = await supabase
            .schema("organization")
            .from("recruiters")
            .select("id, user_id")
            .eq("company_id", activeCompanyId)
            .is("deleted_at", null);
          
          const formattedRecs: { id: string; user: { first_name: string; last_name: string } }[] = [];
          if (recList && recList.length > 0) {
            const userIds = recList.map((r) => r.user_id).filter(Boolean);
            const { data: usersData } = await supabase
              .schema("identity")
              .from("users")
              .select("id, email")
              .in("id", userIds);

            recList.forEach((r) => {
              const userObj = (usersData || []).find((u) => u.id === r.user_id);
              formattedRecs.push({
                id: r.id,
                user: {
                  first_name: userObj?.email?.split("@")[0] || "Recruiter",
                  last_name: "",
                },
              });
            });
          }
          setRecruiters(formattedRecs);

          // Fetch assessment templates (using assessments table)
          const { data: templates } = await supabase
            .schema("assessment")
            .from("assessments")
            .select("id, title, description")
            .eq("company_id", activeCompanyId)
            .is("deleted_at", null);
          setAssessmentTemplates(templates || []);
        }
      } catch (err) {
        logger.error("Failed to load options for Job Wizard", err);
      }
    };

    loadWizardData();
  }, [setValue]);

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
      isValid = await trigger(["title", "departmentId", "type", "experienceLevel", "location", "remotePolicy"]);
    } else if (activeStep === 2) {
      isValid = await trigger(["description", "responsibilities", "requirements", "benefits", "category"]);
    } else if (activeStep === 3) {
      isValid = await trigger(["recruiterId", "mcqAssessmentId", "codingAssessmentId"]);
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
          departmentId: values.departmentId || null,
          recruiterId: values.recruiterId,
          title: values.title,
          description: fullDescription,
          location: values.location,
          type: values.type,
          status: values.status,
          experienceLevel: values.experienceLevel,
          category: values.category || null,
          benefits: values.benefits ? values.benefits.split("\n") : [],
          mcqAssessmentId: values.mcqAssessmentId || null,
          codingAssessmentId: values.codingAssessmentId || null,
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
    <AuthCard
      title="Create Job Posting"
      subtitle={
        <div className="flex items-center gap-1.5 justify-center text-[12px] text-[#6E6E73] font-semibold mt-1">
          <span>Step {activeStep} of 4</span>
          <span className="text-[#AEAEB2]">â€¢</span>
          <span className="text-[#0071E3]">
            {activeStep === 1
              ? "Basic Details"
              : activeStep === 2
              ? "Job Description"
              : activeStep === 3
              ? "Hiring & Assessments"
              : "Publish Status"}
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {errorMsg && (
          <div className="rounded-[12px] bg-[#FFF0EE] border border-[#FFCFCC] p-3 text-[12px] font-semibold text-[#FF3B30] text-left">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: BASIC INFORMATION */}
        {activeStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
            <FormField
              label="Job Title"
              id="title"
              placeholder="Lead Software Engineer"
              error={errors.title?.message}
              disabled={loading}
              {...register("title")}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5 w-full">
                <label htmlFor="departmentId" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                  Department
                </label>
                <select
                  id="departmentId"
                  disabled={loading}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
                  {...register("departmentId")}
                >
                  <option value="">No Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 w-full">
                <label htmlFor="type" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                  Employment Type
                </label>
                <select
                  id="type"
                  disabled={loading}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
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
                <label htmlFor="experienceLevel" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                  Experience Level
                </label>
                <select
                  id="experienceLevel"
                  disabled={loading}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
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
                <label htmlFor="remotePolicy" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                  Remote Policy
                </label>
                <select
                  id="remotePolicy"
                  disabled={loading}
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
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
              placeholder="San Francisco, CA or Remote"
              error={errors.location?.message}
              disabled={loading}
              {...register("location")}
            />
          </div>
        )}

        {/* STEP 2: JOB DESCRIPTION CONTENT */}
        {activeStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200 text-left">
            <FormField
              label="Job Category"
              id="category"
              placeholder="Product Engineering"
              error={errors.category?.message}
              disabled={loading}
              {...register("category")}
            />

            <div className="space-y-1.5">
              <label htmlFor="description" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Job Overview (Rich Description)
              </label>
              <textarea
                id="description"
                rows={4}
                placeholder="Describe the role, impact, and daily responsibilities..."
                className={`w-full rounded-[12px] border px-3.5 py-2.5 text-[13px] bg-white text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150 resize-none ${
                  errors.description ? "border-[#FF3B30] bg-[#FFF0EE]" : "border-[#D2D2D7]"
                }`}
                {...register("description")}
              />
              {errors.description?.message && (
                <p className="text-[11px] font-semibold text-[#FF3B30] mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="responsibilities" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Responsibilities (One per line)
              </label>
              <textarea
                id="responsibilities"
                rows={3}
                placeholder="Build robust React pages...&#10;Optimize Postgres schemas..."
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150 resize-none"
                {...register("responsibilities")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="requirements" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                  Requirements
                </label>
                <textarea
                  id="requirements"
                  rows={3}
                  placeholder="3+ years React experience..."
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150 resize-none"
                  {...register("requirements")}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="benefits" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                  Benefits
                </label>
                <textarea
                  id="benefits"
                  rows={3}
                  placeholder="Full health insurance..."
                  className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:border-[#0071E3] focus:ring-1 focus:ring-[#0071E3] focus:outline-none transition-all duration-150 resize-none"
                  {...register("benefits")}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: HIRING TEAM & ASSESSMENT MAPPING */}
        {activeStep === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200 text-left">
            {/* Recruiter Selector */}
            <div className="space-y-1.5">
              <label htmlFor="recruiterId" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Assigned Lead Recruiter
              </label>
              <select
                id="recruiterId"
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
                {...register("recruiterId")}
              >
                <option value="">Select Recruiter...</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.user.first_name} {r.user.last_name}
                  </option>
                ))}
              </select>
              {errors.recruiterId?.message && (
                <p className="text-[11px] font-semibold text-[#FF3B30] mt-1">{errors.recruiterId.message}</p>
              )}
            </div>

            {/* MCQ Bank Selector */}
            <div className="space-y-1.5">
              <label htmlFor="mcqAssessmentId" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                MCQ Question Bank (Optional)
              </label>
              <select
                id="mcqAssessmentId"
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
                {...register("mcqAssessmentId")}
              >
                <option value="">No MCQ Round</option>
                {assessmentTemplates
                  .filter((t) => t.description === "mcq_bank")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              {assessmentTemplates.filter((t) => t.description === "mcq_bank").length === 0 && (
                <p className="text-[11px] text-[#AEAEB2] mt-1">No MCQ banks found. Create one in Settings â†’ MCQ Banks.</p>
              )}
            </div>

            {/* Coding Bank Selector */}
            <div className="space-y-1.5">
              <label htmlFor="codingAssessmentId" className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Coding Round Bank (Optional)
              </label>
              <select
                id="codingAssessmentId"
                className="w-full rounded-[12px] border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none transition-colors"
                {...register("codingAssessmentId")}
              >
                <option value="">No Coding Round</option>
                {assessmentTemplates
                  .filter((t) => t.description === "coding_test")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              {assessmentTemplates.filter((t) => t.description === "coding_test").length === 0 && (
                <p className="text-[11px] text-[#AEAEB2] mt-1">No coding banks found. Create one in Settings â†’ Coding Tests.</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: PUBLISHING STATE Choice */}
        {activeStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider block">
                Posting Status Choice
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setValue("status", "draft")}
                  className={`flex flex-col items-center justify-center border rounded-[16px] p-6 text-center cursor-pointer transition-all shadow-sm ${
                    watchedValues?.status === "draft"
                      ? "border-[#0071E3] bg-[#EAF3FF] ring-2 ring-[#0071E3]/20"
                      : "border-[#D2D2D7] bg-white hover:border-[#0071E3]"
                  }`}
                >
                  <input
                    type="radio"
                    value="draft"
                    className="sr-only"
                    {...register("status")}
                    checked={watchedValues?.status === "draft"}
                  />
                  <span className="font-bold text-[#1D1D1F] text-sm">Save as Draft</span>
                  <span className="text-[11px] text-[#6E6E73] mt-1.5 leading-relaxed max-w-[150px]">
                    Internal preview only. Candidate pipeline will not open.
                  </span>
                </div>

                <div
                  onClick={() => setValue("status", "published")}
                  className={`flex flex-col items-center justify-center border rounded-[16px] p-6 text-center cursor-pointer transition-all shadow-sm ${
                    watchedValues?.status === "published"
                      ? "border-[#0071E3] bg-[#EAF3FF] ring-2 ring-[#0071E3]/20"
                      : "border-[#D2D2D7] bg-white hover:border-[#0071E3]"
                  }`}
                >
                  <input
                    type="radio"
                    value="published"
                    className="sr-only"
                    {...register("status")}
                    checked={watchedValues?.status === "published"}
                  />
                  <span className="font-bold text-[#0071E3] text-sm flex items-center gap-1">
                    <Sparkles className="h-4 w-4" /> Publish Live
                  </span>
                  <span className="text-[11px] text-[#6E6E73] mt-1.5 leading-relaxed max-w-[150px]">
                    Publish opening immediately to applicant jobs boards.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex justify-between items-center pt-6 border-t border-[#E8E8ED] mt-6">
          {activeStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevStep}
              disabled={loading}
              className="flex items-center gap-1.5 border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F2F2F2] rounded-[12px] h-10 px-4 text-[13px] font-medium"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/recruiter/jobs")}
              disabled={loading}
              className="flex items-center gap-1.5 border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F2F2F2] rounded-[12px] h-10 px-4 text-[13px] font-medium"
            >
              Cancel
            </Button>
          )}

          {activeStep < 4 ? (
            <Button
              type="button"
              onClick={handleNextStep}
              className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-10 px-6 rounded-[12px] text-[13px] font-semibold transition-colors duration-150"
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading || !companyId}
              className="bg-[#0071E3] hover:bg-[#006ACC] text-white flex items-center gap-1.5 h-10 px-6 rounded-[12px] text-[13px] font-semibold transition-colors duration-150"
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
    </AuthCard>
  );
}
