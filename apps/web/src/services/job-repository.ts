import { createJobClient } from "@/utils/supabase/job";
import { logger } from "@smarthire/logger";
import { z } from "zod";
import { jobCreateSchema, jobUpdateSchema } from "./job-schemas";

type JobCreateInput = z.infer<typeof jobCreateSchema>;
type JobUpdateInput = z.infer<typeof jobUpdateSchema>;

export interface JobFilters {
  status?: "draft" | "published" | "closed";
  category?: string;
  location?: string;
  type?: "full-time" | "part-time" | "contract" | "internship";
}

/** Convert a Supabase PostgrestError (or any unknown) into a proper Error instance */
function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object") {
    const pg = err as Record<string, unknown>;
    const msg = (pg.message ?? pg.details ?? pg.hint ?? JSON.stringify(pg)) as string;
    return new Error(msg);
  }
  return new Error(String(err));
}

/**
 * Data Repository Layer for Job Service
 */
export const jobRepository = {
  /**
   * List jobs based on filters
   */
  listJobs: async (filters: JobFilters) => {
    logger.info("Repository: Listing jobs with filters", filters);
    const supabase = await createJobClient();

    let query = supabase.from("jobs").select("*").is("deleted_at", null);

    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.category) {
      query = query.eq("category", filters.category);
    }
    if (filters.location) {
      query = query.ilike("location", `%${filters.location}%`);
    }
    if (filters.type) {
      query = query.eq("type", filters.type);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      logger.error("Repository error: listJobs failed", error);
      throw toError(error);
    }
    return data;
  },

  /**
   * Fetch single job details
   */
  getJobById: async (jobId: string) => {
    logger.info(`Repository: Fetching job by ID: ${jobId}`);
    const supabase = await createJobClient();

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      logger.error("Repository error: getJobById failed", error);
      throw toError(error);
    }
    return data;
  },

  /**
   * Create a job posting (default status draft)
   */
  insertJob: async (job: JobCreateInput) => {
    logger.info(`Repository: Inserting job posting: ${job.title}`);
    const supabase = await createJobClient();

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        company_id: job.companyId,
        department_id: job.departmentId,
        recruiter_id: job.recruiterId,
        title: job.title,
        description: job.description,
        location: job.location,
        type: job.type,
        status: job.status,
        salary_min: job.salaryMin,
        salary_max: job.salaryMax,
        experience_level: job.experienceLevel,
        category: job.category,
        benefits: job.benefits,
        mcq_assessment_id: job.mcqAssessmentId ?? null,
        coding_assessment_id: job.codingAssessmentId ?? null,
        application_deadline: (job as any).applicationDeadline || (job as any).application_deadline || null,
        published_at: (job as any).publishedAt || (job as any).published_at || (job.status === "published" ? new Date().toISOString() : null),
      })
      .select()
      .maybeSingle();

    if (error) {
      logger.error("Repository error: insertJob failed", error);
      throw toError(error);
    }
    return data || { title: job.title, status: job.status };
  },

  /**
   * Edit job details
   */
  updateJob: async (jobId: string, job: JobUpdateInput) => {
    logger.info(`Repository: Updating job: ${jobId}`);
    const supabase = await createJobClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("jobs")
      .update({
        department_id: job.departmentId !== undefined ? job.departmentId : undefined,
        title: job.title,
        description: job.description,
        location: job.location,
        type: job.type,
        status: job.status,
        salary_min: job.salaryMin !== undefined ? job.salaryMin : undefined,
        salary_max: job.salaryMax !== undefined ? job.salaryMax : undefined,
        experience_level: job.experienceLevel,
        category: job.category,
        benefits: job.benefits,
        application_deadline: (job as any).applicationDeadline !== undefined ? (job as any).applicationDeadline : undefined,
        published_at: job.status === "published" ? now : undefined,
        updated_at: now,
      })
      .eq("id", jobId)
      .is("deleted_at", null)
      .select()
      .maybeSingle();

    if (error) {
      logger.error("Repository error: updateJob failed", error);
      throw toError(error);
    }
    return data || { id: jobId, ...job };
  },

  /**
   * Transition Job Status (draft, published, closed)
   */
  updateJobStatus: async (jobId: string, status: "draft" | "published" | "closed") => {
    logger.info(`Repository: Changing status of job: ${jobId} to ${status}`);
    const supabase = await createJobClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("jobs")
      .update({
        status,
        updated_at: now,
      })
      .eq("id", jobId)
      .is("deleted_at", null)
      .select()
      .maybeSingle();

    if (error) {
      logger.error("Repository error: updateJobStatus failed", error);
      throw toError(error);
    }
    return data || { id: jobId, status };
  },

  /**
   * Soft delete a job posting
   */
  softDeleteJob: async (jobId: string) => {
    logger.info(`Repository: Soft deleting job: ${jobId}`);
    const supabase = await createJobClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("jobs")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", jobId);

    if (error) {
      logger.error("Repository error: softDeleteJob failed", error);
      throw toError(error);
    }
  },
};
