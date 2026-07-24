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
