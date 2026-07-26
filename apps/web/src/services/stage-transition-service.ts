import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const appClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "application" } });
const jobClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "job" } });
const candClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "candidate" } });

export interface StageTransitionResult {
  success: boolean;
  applicationId: string;
  previousStage: string;
  newStage: string;
  error?: string;
}

/**
 * Standard Stage Messages dictionary for Candidate In-App Notifications
 */
const STAGE_NOTIFICATION_MAP: Record<string, { type: string; subject: string; template: (jobTitle: string) => string }> = {
  screening: {
    type: "STAGE_SCREENING",
    subject: "Application Moved to Screening",
    template: (title) => `Your application for ${title} has moved to ATS Screening.`,
  },
  mcq: {
    type: "STAGE_MCQ",
    subject: "MCQ Assessment Scheduled",
    template: (title) => `Your application for ${title} has progressed to the MCQ Screening Assessment round.`,
  },
  coding: {
    type: "STAGE_CODING",
    subject: "Coding Assessment Scheduled",
    template: (title) => `Your application for ${title} has progressed to the Technical IDE Coding Assessment round.`,
  },
  interview: {
    type: "STAGE_AI_INTERVIEW",
    subject: "AI Interview Scheduled",
    template: (title) => `Your application for ${title} has progressed to the Autonomous AI Technical Interview stage.`,
  },
  zoom_interview: {
    type: "STAGE_RECRUITER_INTERVIEW",
    subject: "Recruiter Final Interview Scheduled",
    template: (title) => `Your application for ${title} has progressed to the Recruiter Final Interview round.`,
  },
  hiring_decision: {
    type: "STAGE_HIRING_DECISION",
    subject: "Final Interview Completed",
    template: (title) => `Your Recruiter Final Interview for ${title} is complete and under final hiring review.`,
  },
  offer: {
    type: "STAGE_OFFER",
    subject: "Job Offer Received",
    template: (title) => `An official employment offer letter is now available for your application to ${title}.`,
  },
  offer_sent: {
    type: "STAGE_OFFER",
    subject: "Job Offer Received",
    template: (title) => `An official employment offer letter is now available for your application to ${title}.`,
  },
  offered: {
    type: "STAGE_OFFER",
    subject: "Job Offer Available",
    template: (title) => `An official employment offer letter is now available for your application to ${title}.`,
  },
  hired: {
    type: "STAGE_HIRED",
    subject: "Congratulations — Hired!",
    template: (title) => `Congratulations! You have been officially hired for ${title}. Welcome aboard!`,
  },
  joined: {
    type: "STAGE_JOINED",
    subject: "Onboarding & Joining Confirmed",
    template: (title) => `Welcome to the team! Your joining process for ${title} is confirmed.`,
  },
  rejected: {
    type: "STAGE_REJECTED",
    subject: "Application Status Update",
    template: (title) => `Thank you for your interest. Your application for ${title} will not be progressing further in this recruitment process.`,
  },
};

export const stageTransitionService = {
  /**
   * Centralized Application Stage Transition Executor
   */
  async transitionStage(params: {
    applicationId: string;
    destinationStage: string;
    changedByUserId?: string;
    notes?: string;
  }): Promise<StageTransitionResult> {
    try {
      // 1. Fetch application details
      const { data: app, error: appErr } = await appClient
        .from("applications")
        .select("id, candidate_id, job_id, status")
        .eq("id", params.applicationId)
        .is("deleted_at", null)
        .maybeSingle();

      if (appErr || !app) {
        logger.error("[StageTransitionService] Application not found", appErr);
        return { success: false, applicationId: params.applicationId, previousStage: "", newStage: params.destinationStage, error: "Application record not found" };
      }

      const previousStage = app.status;
      if (previousStage === params.destinationStage) {
        logger.info(`[StageTransitionService] Application ${app.id} is already in stage ${params.destinationStage}`);
        return { success: true, applicationId: app.id, previousStage, newStage: params.destinationStage };
      }

      // 2. Update application status
      const { error: updateErr } = await appClient
        .from("applications")
        .update({
          status: params.destinationStage,
          updated_at: new Date().toISOString(),
          rejection_stage: params.destinationStage === "rejected" ? previousStage : undefined,
        })
        .eq("id", app.id);

      if (updateErr) {
        logger.error("[StageTransitionService] Failed to update status in DB", updateErr);
        return { success: false, applicationId: app.id, previousStage, newStage: params.destinationStage, error: updateErr.message };
      }

      // 3. Insert status history record
      try {
        await appClient.from("application_status_history").insert({
          application_id: app.id,
          from_status: previousStage,
          to_status: params.destinationStage,
          notes: params.notes || `Stage transition from ${previousStage} to ${params.destinationStage}`,
          changed_by: params.changedByUserId || null,
        });
      } catch (histErr) {
        logger.warn("[StageTransitionService] Status history log failed", histErr);
      }

      // 4. Generate Candidate Notification via DomainEventService (Idempotent)
      try {
        // Fetch candidate user ID
        const { data: cand } = await candClient
          .from("candidates")
          .select("user_id, id")
          .eq("id", app.candidate_id)
          .maybeSingle();

        const candidateUserId = cand?.user_id || app.candidate_id;

        // Fetch job title
        const { data: job } = await jobClient
          .from("jobs")
          .select("title")
          .eq("id", app.job_id)
          .maybeSingle();

        const jobTitle = job?.title || "Job Position";

        const { DomainEventService } = await import("@/services/notification/domain-event-service");
        await DomainEventService.notifyStageChanged({
          candidateUserId,
          applicationId: app.id,
          jobId: app.job_id,
          jobTitle,
          newStage: params.destinationStage,
        });
      } catch (notifErr) {
        logger.error("[StageTransitionService] Error triggering stage notification", notifErr);
      }

      logger.info(`[StageTransitionService] Successfully transitioned application ${app.id}: ${previousStage} -> ${params.destinationStage}`);
      return { success: true, applicationId: app.id, previousStage, newStage: params.destinationStage };
    } catch (err: unknown) {
      logger.error("[StageTransitionService] Unhandled error during stage transition", err);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, applicationId: params.applicationId, previousStage: "", newStage: params.destinationStage, error: msg };
    }
  },
};
