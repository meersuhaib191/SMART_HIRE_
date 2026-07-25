import { applicationRepository, ApplicationFilters } from "./application-repository";
import { applyJobSchema, updateApplicationStatusSchema } from "./application-schemas";
import { logger } from "@smarthire/logger";

/**
 * Service Layer for Application Service (Clean Architecture Logic)
 */
export const applicationService = {
  /**
   * List job applications matching filters
   */
  listApplications: async (filters: ApplicationFilters) => {
    logger.info("Service: listApplications initiated with filters", filters);
    return await applicationRepository.listApplications(filters);
  },

  /**
   * Fetch single application loaded with history timeline logs
   */
  getApplicationDetails: async (applicationId: string) => {
    logger.info(`Service: getApplicationDetails for: ${applicationId}`);
    return await applicationRepository.getApplicationById(applicationId);
  },

  /**
   * Submit job application (Apply for Job)
   */
  applyJob: async (payload: unknown, userId?: string) => {
    logger.info("Service: applyJob initiated");
    const result = applyJobSchema.safeParse(payload);

    if (!result.success) {
      logger.error("Service: Job application validation failed", result.error.flatten());
      throw new Error(JSON.stringify(result.error.flatten()));
    }

    const { jobId } = result.data;

    // 1. Verify job is published and application deadline has not passed
    const { createBrowserClient } = await import("@supabase/ssr");
    const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
    const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";
    const jobDb = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "job" } });

    const { data: targetJob } = await jobDb
      .from("jobs")
      .select("id, title, status, application_deadline")
      .eq("id", jobId)
      .maybeSingle();

    if (targetJob) {
      if (targetJob.status !== "published") {
        throw new Error("Applications for this job are currently not open.");
      }
      if (targetJob.application_deadline && new Date() > new Date(targetJob.application_deadline)) {
        throw new Error("Applications for this job are closed.");
      }
    }

    const app = await applicationRepository.insertApplication(result.data);

    // Initial Status History log
    try {
      await applicationRepository.insertStatusHistory({
        applicationId: app.id,
        fromStatus: "none",
        toStatus: "applied",
        notes: "Application submitted by candidate",
        changedBy: userId || null,
      });
    } catch (histErr) {
      logger.warn("Status history logging skipped", histErr);
    }

    // Candidate Notification for Application Submitted
    if (userId) {
      try {
        const { notificationService } = await import("@/services/notification-service");
        const jobTitle = targetJob?.title || "Job Position";
        await notificationService.createNotification({
          userId,
          type: "APPLICATION_SUBMITTED",
          subject: "Application Submitted",
          body: `Your application for ${jobTitle} has been submitted successfully.`,
          metadata: { applicationId: app.id, jobId: app.job_id },
          idempotencyKey: `notif_app_sub_${app.id}`,
        });
      } catch (notifErr) {
        logger.warn("Application submission notification skipped", notifErr);
      }
    }

    // Publish Event
    logger.info("[EVENT_BUS] Publish: ApplicationSubmitted", {
      applicationId: app.id,
      candidateId: app.candidate_id,
      jobId: app.job_id,
    });

    return app;
  },

  /**
   * Update application status state (Recruiter moving candidates through pipeline)
   */
  updateStatus: async (applicationId: string, recruiterUserId: string, payload: unknown) => {
    logger.info(`Service: updateStatus initiated for application: ${applicationId}`);
    const result = updateApplicationStatusSchema.safeParse(payload);

    if (!result.success) {
      logger.error("Service: Status update validation failed", result.error.flatten());
      throw new Error(JSON.stringify(result.error.flatten()));
    }

    const existing = await applicationRepository.getApplicationById(applicationId);
    if (!existing) {
      throw new Error("Application not found");
    }

    const { status, notes, rejection_stage } = result.data;
    const fromStatus = existing.status;

    if (fromStatus === status && existing.rejection_stage === rejection_stage) {
      return existing; // No status change required
    }

    const updatedApp = await applicationRepository.updateApplicationStatus(applicationId, status, rejection_stage);

    // Append Status History log with recruiter notes (non-blocking if history table error)
    try {
      await applicationRepository.insertStatusHistory({
        applicationId,
        fromStatus,
        toStatus: status,
        notes: notes || "Recruiter status update",
        changedBy: recruiterUserId,
      });
    } catch (histErr) {
      logger.warn(`[applicationService] Status history log skipped: ${histErr}`);
    }

    // Check status type and Publish appropriate Event
    if (status === "rejected") {
      logger.info("[EVENT_BUS] Publish: ApplicationRejected", { applicationId, recruiterUserId });
    } else if (status === "offered") {
      logger.info("[EVENT_BUS] Publish: ApplicationAccepted", { applicationId, recruiterUserId });
    } else {
      logger.info("[EVENT_BUS] Publish: ApplicationUpdated", {
        applicationId,
        fromStatus,
        toStatus: status,
        recruiterUserId,
      });
    }

    return updatedApp;
  },

  /**
   * Withdraw application (Candidate withdrawing from hiring pipeline)
   */
  withdrawApplication: async (applicationId: string, candidateUserId: string) => {
    logger.info(`Service: withdrawApplication for application: ${applicationId}`);

    const existing = await applicationRepository.getApplicationById(applicationId);
    if (!existing) {
      throw new Error("Application not found");
    }

    const fromStatus = existing.status;
    if (fromStatus === "withdrawn") {
      return existing;
    }

    const updatedApp = await applicationRepository.updateApplicationStatus(applicationId, "withdrawn");

    // Log status history transition
    await applicationRepository.insertStatusHistory({
      applicationId,
      fromStatus,
      toStatus: "withdrawn",
      notes: "Application withdrawn by candidate",
      changedBy: candidateUserId,
    });

    // Publish Event
    logger.info("[EVENT_BUS] Publish: ApplicationWithdrawn", { applicationId, candidateUserId });

    return updatedApp;
  },
};
