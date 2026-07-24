import { createAppClient } from "@/utils/supabase/application";
import { logger } from "@smarthire/logger";
import { z } from "zod";
import { applyJobSchema } from "./application-schemas";

type ApplyJobInput = z.infer<typeof applyJobSchema>;

export interface ApplicationFilters {
  status?: string;
  jobId?: string;
  candidateId?: string;
}

export interface StatusHistoryInput {
  applicationId: string;
  fromStatus: string;
  toStatus: string;
  notes?: string | null;
  changedBy?: string | null;
}

/**
 * Data Repository Layer for Application Service
 */
export const applicationRepository = {
  /**
   * List applications based on status, job, or candidate filters
   */
  listApplications: async (filters: ApplicationFilters) => {
    logger.info("Repository: Listing applications with filters", filters);
    const supabase = await createAppClient();

    let query = supabase
      .from("applications")
      .select("*")
      .is("deleted_at", null);

    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.jobId) {
      query = query.eq("job_id", filters.jobId);
    }
    if (filters.candidateId) {
      query = query.eq("candidate_id", filters.candidateId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      logger.error("Repository error: listApplications failed", error);
      throw error;
    }
    return data;
  },

  /**
   * Fetch single application loaded with its status history timeline
   */
  getApplicationById: async (applicationId: string) => {
    logger.info(`Repository: Fetching application details: ${applicationId}`);
    const supabase = await createAppClient();

    const { data, error } = await supabase
      .from("applications")
      .select(`
        *,
        application_status_history(
          id,
          from_status,
          to_status,
          notes,
          created_at,
          changed_by
        )
      `)
      .eq("id", applicationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      logger.error("Repository error: getApplicationById failed", error);
      throw error;
    }
    return data;
  },

  /**
   * Insert new job application record
   */
  insertApplication: async (app: ApplyJobInput) => {
    logger.info(`Repository: Submitting application for candidate ${app.candidateId} to job ${app.jobId}`);
    const supabase = await createAppClient();

    const { data, error } = await supabase
      .from("applications")
      .insert({
        job_id: app.jobId,
        candidate_id: app.candidateId,
        resume_id: app.resumeId,
        status: "applied",
        score: 2,
      })
      .select()
      .single();

    if (error) {
      logger.error("Repository error: insertApplication failed", error);
      throw error;
    }
    return data;
  },

  /**
   * Update application status state
   */
  updateApplicationStatus: async (applicationId: string, status: string, rejectionStage?: string | null) => {
    logger.info(`Repository: Transitioning status of application ${applicationId} to ${status} (rejectionStage: ${rejectionStage})`);
    const supabase = await createAppClient();
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      status,
      updated_at: now,
    };
    if (rejectionStage !== undefined) {
      updatePayload.rejection_stage = rejectionStage;
    }

    const { data, error } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("id", applicationId)
      .is("deleted_at", null)
      .select();

    if (error) {
      logger.error("Repository error: updateApplicationStatus failed", error);
      throw error;
    }

    if (data && data.length > 0) {
      return data[0];
    }

    // Fallback: fetch record directly if RLS blocked returning select
    const fetched = await applicationRepository.getApplicationById(applicationId);
    return fetched;
  },

  /**
   * Update per-stage score columns on an application
   */
  updateStageScores: async (
    applicationId: string,
    scores: {
      screening_score?: number;
      mcq_score?: number;
      mcq_total?: number;
      mcq_passed?: boolean;
      coding_score?: number;
      coding_total?: number;
      coding_passed?: boolean;
      interview_avg_score?: number;
      interview_recommendation?: string;
    }
  ) => {
    logger.info(`Repository: Updating stage scores for application ${applicationId}`, scores);
    const supabase = await createAppClient();
    const now = new Date().toISOString();

    // Build the update payload with only defined values
    const updatePayload: Record<string, unknown> = { updated_at: now };
    for (const [key, value] of Object.entries(scores)) {
      if (value !== undefined && value !== null) {
        updatePayload[key] = value;
      }
    }

    const { data, error } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("id", applicationId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      logger.error("Repository error: updateStageScores failed", error);
      throw error;
    }
    return data;
  },

  /**
   * Log transition inside the application status history table
   */
  insertStatusHistory: async (history: StatusHistoryInput) => {
    logger.info(`Repository: Logging status history log from ${history.fromStatus} to ${history.toStatus}`);
    const supabase = await createAppClient();

    const { data, error } = await supabase
      .from("application_status_history")
      .insert({
        application_id: history.applicationId,
        from_status: history.fromStatus,
        to_status: history.toStatus,
        notes: history.notes,
        changed_by: history.changedBy,
      })
      .select()
      .single();

    if (error) {
      logger.error("Repository error: insertStatusHistory failed", error);
      throw error;
    }
    return data;
  },
};
