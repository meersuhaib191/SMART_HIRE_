"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FormField } from "@/components/auth";
import { Button } from "@smarthire/ui";
import { ArrowLeft, Loader2, Save, Briefcase } from "lucide-react";
import { logger } from "@smarthire/logger";
import { createBrowserClient } from "@supabase/ssr";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const orgClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "organization" } });

const editJobSchema = z.object({
  title: z.string().min(1, "Job title is required").max(255),
  departmentId: z.string().uuid("Invalid department").optional().nullable(),
  type: z.enum(["full-time", "part-time", "contract", "internship"]),
  experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]),
  location: z.string().min(1, "Location description is required").max(150),
  description: z.string().min(1, "Job description content is required"),
  category: z.string().max(100).optional().nullable(),
  status: z.enum(["draft", "published", "closed"]),
});

type EditJobValues = z.infer<typeof editJobSchema>;

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [departments, setDepartments] = React.useState<{ id: string; name: string }[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EditJobValues>({
    resolver: zodResolver(editJobSchema),
  });

  React.useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch current job details
        const jobRes = await fetch(`/api/jobs/${jobId}`);
        if (!jobRes.ok) throw new Error("Failed to fetch job details");
        const { data: job } = await jobRes.json();

        // Prefill form values
        setValue("title", job.title);
        setValue("departmentId", job.department_id);
        setValue("type", job.type);
        setValue("experienceLevel", job.experience_level);
        setValue("location", job.location || "");
        setValue("description", job.description);
        setValue("category", job.category || "");
        setValue("status", job.status);

        // Fetch company departments
        if (job.company_id) {
          const { data: depts } = await orgClient
            .from("departments")
            .select("id, name")
            .eq("company_id", job.company_id)
            .is("deleted_at", null);
          setDepartments(depts || []);
        }
      } catch (err) {
        logger.error("Failed to load details for editing", err);
        setErrorMsg("Failed to load job posting data.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [jobId, setValue]);

  const onSubmit = async (values: EditJobValues) => {
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          departmentId: values.departmentId || null,
          type: values.type,
          experienceLevel: values.experienceLevel,
          location: values.location,
          description: values.description,
          category: values.category || null,
          status: values.status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Failed to update job posting");
      }

      logger.info("[EditJobPage] Job details updated successfully");
      router.push(`/recruiter/jobs/${jobId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed. Please check inputs.";
      setErrorMsg(message);
      logger.error("[EditJobPage] Error saving changes", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Briefcase className="h-4 w-4" /> Recruiter Management
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
            Edit Job Posting
          </h1>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Modify job requirements, description, and hiring pipeline status.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/recruiter/jobs/${jobId}`)}
          className="text-xs font-semibold self-start sm:self-auto gap-1.5 border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Details
        </Button>
      </div>

      {/* Main Container Card (Crisp White Light Theme) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-red-600">
              {errorMsg}
            </div>
          )}

          <FormField
            label="Job Title"
            id="title"
            placeholder="Lead Software Engineer"
            error={errors.title?.message}
            disabled={saving}
            {...register("title")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="space-y-1.5 w-full">
              <label htmlFor="departmentId" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Department
              </label>
              <select
                id="departmentId"
                disabled={saving}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors font-medium"
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
              <label htmlFor="type" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Employment Type
              </label>
              <select
                id="type"
                disabled={saving}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="space-y-1.5 w-full">
              <label htmlFor="experienceLevel" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Experience Level
              </label>
              <select
                id="experienceLevel"
                disabled={saving}
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
              <label htmlFor="status" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Posting Status
              </label>
              <select
                id="status"
                disabled={saving}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none transition-colors font-medium"
                {...register("status")}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed / Archived</option>
              </select>
            </div>

            <FormField
              label="Location"
              id="location"
              placeholder="San Francisco, CA or Remote"
              error={errors.location?.message}
              disabled={saving}
              {...register("location")}
            />
          </div>

          <FormField
            label="Job Category"
            id="category"
            placeholder="Product Engineering"
            error={errors.category?.message}
            disabled={saving}
            {...register("category")}
          />

          <div className="space-y-1.5 text-left">
            <label htmlFor="description" className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
              Job Description & Content
            </label>
            <textarea
              id="description"
              rows={5}
              placeholder="Role description content..."
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-600 focus:outline-none transition-colors font-medium"
              {...register("description")}
            />
            {errors.description?.message && (
              <p className="text-xs font-semibold text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Navigation Control Buttons */}
          <div className="flex justify-between items-center pt-5 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/recruiter/jobs/${jobId}`)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl text-xs font-semibold border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700"
            >
              <ArrowLeft className="h-4 w-4" /> Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 h-10 px-6 rounded-xl text-xs font-semibold transition-colors duration-150"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <>
                  Save Changes <Save className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
