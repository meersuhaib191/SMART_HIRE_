/**
 * Domain Event Notification Service
 *
 * Single, authoritative service for creating persistent, structured, idempotent
 * notifications in response to core SmartHire domain events.
 */

import { createNotificationClient } from "@/utils/supabase/notification";
import { logger } from "@smarthire/logger";

export interface DomainNotificationInput {
  recipientUserId: string;
  recipientRole: "candidate" | "recruiter" | "company" | "admin";
  type: string;
  subject: string;
  body: string;
  entityType:
    | "application"
    | "assessment"
    | "ai_interview_result"
    | "final_interview"
    | "offer"
    | "job"
    | "system";
  entityId: string;
  jobId?: string;
  applicationId?: string;
  assessmentId?: string;
  actionUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export const DomainEventService = {
  /**
   * Primary method to persist a structured notification for a single recipient.
   */
  async createNotification(input: DomainNotificationInput): Promise<boolean> {
    try {
      const supabase = await createNotificationClient();

      const idempotencyKey =
        input.idempotencyKey ||
        `${input.recipientUserId}:${input.type}:${input.entityId}`;

      // Check idempotency first to avoid duplicate notifications
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing) {
        logger.info(`[DomainEventService] Duplicate notification suppressed (key: ${idempotencyKey})`);
        return true;
      }

      const structuredMetadata = {
        recipient_role: input.recipientRole,
        entity_type: input.entityType,
        entity_id: input.entityId,
        job_id: input.jobId,
        application_id: input.applicationId,
        assessment_id: input.assessmentId,
        action_url: input.actionUrl,
        ...(input.metadata || {}),
      };

      const { error } = await supabase.from("notifications").insert({
        user_id: input.recipientUserId,
        type: input.type,
        subject: input.subject,
        body: input.body,
        metadata: structuredMetadata,
        idempotency_key: idempotencyKey,
        is_read: false,
      });

      if (error) {
        logger.error("[DomainEventService] Failed to insert notification", error);
        return false;
      }

      logger.info(`[DomainEventService] Notification created: ${input.type} for user ${input.recipientUserId}`);
      return true;
    } catch (err) {
      logger.error("[DomainEventService] Exception in createNotification", err);
      return false;
    }
  },

  /**
   * Helper: Resolve raw candidate ID or user ID to authoritative auth.users.id
   */
  async resolveCandidateUserId(rawId: string): Promise<string> {
    if (!rawId) return "";
    try {
      const supabase = await createNotificationClient();
      const { data } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("user_id")
        .or(`id.eq.${rawId},user_id.eq.${rawId}`)
        .maybeSingle();

      return data?.user_id || rawId;
    } catch {
      return rawId;
    }
  },

  /**
   * Helper: Resolve raw recruiter IDs, job ID, or company ID to authoritative auth.users.id array
   */
  async resolveRecruiterUserIds(rawIds: string[] = [], jobId?: string, companyId?: string): Promise<string[]> {
    const userIds = new Set<string>();
    try {
      const supabase = await createNotificationClient();

      // 1. Direct IDs resolution
      for (const rawId of rawIds) {
        if (!rawId) continue;
        const { data } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("user_id")
          .or(`id.eq.${rawId},user_id.eq.${rawId}`)
          .maybeSingle();

        if (data?.user_id) userIds.add(data.user_id);
        else userIds.add(rawId);
      }

      // 2. If jobId provided and no userIds found yet, lookup job recruiter & creator
      if (jobId && userIds.size === 0) {
        const { data: job } = await supabase
          .schema("job")
          .from("jobs")
          .select("recruiter_id, company_id")
          .eq("id", jobId)
          .maybeSingle();

        if (job?.recruiter_id) {
          const { data: rec } = await supabase
            .schema("organization")
            .from("recruiters")
            .select("user_id")
            .or(`id.eq.${job.recruiter_id},user_id.eq.${job.recruiter_id}`)
            .maybeSingle();

          if (rec?.user_id) userIds.add(rec.user_id);
        }
        if (!companyId && job?.company_id) {
          companyId = job.company_id;
        }
      }

      // 3. Fallback: If companyId provided, notify all recruiters in company
      if (companyId && userIds.size === 0) {
        const { data: recs } = await supabase
          .schema("organization")
          .from("recruiters")
          .select("user_id")
          .eq("company_id", companyId);

        if (recs) {
          recs.forEach((r) => {
            if (r.user_id) userIds.add(r.user_id);
          });
        }
      }
    } catch (err) {
      logger.error("[DomainEventService] Error resolving recruiter user IDs", err);
    }
    return Array.from(userIds);
  },

  /**
   * Helper: Candidate Application Status / Stage Changed
   */
  async notifyStageChanged(params: {
    candidateUserId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    newStage: string;
  }) {
    const targetUserId = await this.resolveCandidateUserId(params.candidateUserId);
    const stageTitles: Record<string, string> = {
      screening: "Advanced to ATS Screening",
      mcq: "Advanced to MCQ Assessment",
      coding: "Advanced to IDE Coding Assessment",
      interview: "Advanced to AI Interview",
      zoom_interview: "Advanced to Recruiter Final Interview",
      hiring_decision: "Moved to Hiring Decision Review",
      offer_sent: "Received an Official Offer",
      hired: "Hiring Decision Finalized — Hired!",
      rejected: "Application Status Update",
    };

    const title = stageTitles[params.newStage] || `Application Stage Updated: ${params.newStage}`;
    const body = `Your application for ${params.jobTitle} has been moved to ${params.newStage.replace("_", " ").toUpperCase()}.`;

    return this.createNotification({
      recipientUserId: targetUserId,
      recipientRole: "candidate",
      type: "APPLICATION_STAGE_CHANGED",
      subject: title,
      body,
      entityType: "application",
      entityId: params.applicationId,
      jobId: params.jobId,
      applicationId: params.applicationId,
      actionUrl: "/candidate/applications",
      idempotencyKey: `cand_stage:${params.applicationId}:${params.newStage}`,
    });
  },

  /**
   * Helper: AI Interview Evaluation Ready -> Recruiter Notification
   */
  async notifyAIInterviewEvaluationReady(params: {
    recruiterUserIds: string[];
    candidateName: string;
    jobTitle: string;
    applicationId: string;
    jobId: string;
    overallScore: number;
    passed: boolean;
  }) {
    const targetUserIds = await this.resolveRecruiterUserIds(params.recruiterUserIds, params.jobId);
    const subject = `${params.candidateName}'s AI Interview Evaluation Ready`;
    const body = `Completed AI Interview for ${params.jobTitle}. Overall Score: ${params.overallScore}% (${params.passed ? "PASSED" : "NEEDS REVIEW"}).`;

    let success = true;
    for (const recruiterId of targetUserIds) {
      const res = await this.createNotification({
        recipientUserId: recruiterId,
        recipientRole: "recruiter",
        type: "AI_INTERVIEW_EVALUATION_READY",
        subject,
        body,
        entityType: "ai_interview_result",
        entityId: params.applicationId,
        jobId: params.jobId,
        applicationId: params.applicationId,
        actionUrl: `/recruiter/pipeline?jobId=${params.jobId}&round=interview&appId=${params.applicationId}`,
        idempotencyKey: `ai_eval:${params.applicationId}:${params.overallScore}`,
      });
      if (!res) success = false;
    }
    return success;
  },

  /**
   * Helper: Assessment Scheduled (MCQ / Coding / AI Interview) -> Candidate
   */
  async notifyAssessmentScheduled(params: {
    candidateUserId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    assessmentType: "mcq" | "coding" | "ai_interview";
    scheduledStartAt: string;
  }) {
    const targetUserId = await this.resolveCandidateUserId(params.candidateUserId);
    const typeLabel =
      params.assessmentType === "mcq"
        ? "MCQ Assessment"
        : params.assessmentType === "coding"
        ? "IDE Coding Assessment"
        : "AI Interview";

    const formattedDate = new Date(params.scheduledStartAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const subject = `${typeLabel} Scheduled`;
    const body = `Your ${typeLabel} for ${params.jobTitle} is scheduled for ${formattedDate}.`;

    const targetUrl =
      params.assessmentType === "ai_interview"
        ? "/candidate/interviews"
        : "/candidate/assessments";

    return this.createNotification({
      recipientUserId: targetUserId,
      recipientRole: "candidate",
      type: "ASSESSMENT_SCHEDULED",
      subject,
      body,
      entityType: "assessment",
      entityId: params.applicationId,
      jobId: params.jobId,
      applicationId: params.applicationId,
      actionUrl: targetUrl,
      idempotencyKey: `sched_${params.assessmentType}:${params.applicationId}:${params.scheduledStartAt}`,
    });
  },

  /**
   * Helper: Recruiter Final Interview Scheduled -> Candidate
   */
  async notifyFinalInterviewScheduled(params: {
    candidateUserId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    scheduledAt: string;
    meetingUrl?: string;
  }) {
    const targetUserId = await this.resolveCandidateUserId(params.candidateUserId);
    const formattedDate = new Date(params.scheduledAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const subject = "Recruiter Final Interview Scheduled";
    const body = `Your live final interview for ${params.jobTitle} has been scheduled for ${formattedDate}.`;

    return this.createNotification({
      recipientUserId: targetUserId,
      recipientRole: "candidate",
      type: "FINAL_INTERVIEW_SCHEDULED",
      subject,
      body,
      entityType: "final_interview",
      entityId: params.applicationId,
      jobId: params.jobId,
      applicationId: params.applicationId,
      actionUrl: "/candidate/interviews",
      idempotencyKey: `final_sched:${params.applicationId}:${params.scheduledAt}`,
    });
  },

  /**
   * Helper: Offer Sent -> Candidate
   */
  async notifyOfferSent(params: {
    candidateUserId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
  }) {
    const targetUserId = await this.resolveCandidateUserId(params.candidateUserId);
    const subject = `Official Offer Received — ${params.companyName}`;
    const body = `Congratulations! ${params.companyName} has issued you an official job offer for ${params.jobTitle}.`;

    return this.createNotification({
      recipientUserId: targetUserId,
      recipientRole: "candidate",
      type: "OFFER_SENT",
      subject,
      body,
      entityType: "offer",
      entityId: params.applicationId,
      jobId: params.jobId,
      applicationId: params.applicationId,
      actionUrl: "/candidate/applications",
      idempotencyKey: `offer_sent:${params.applicationId}`,
    });
  },

  /**
   * Helper: Offer Responded (Accepted / Declined) -> Recruiter(s) & Company
   */
  async notifyOfferResponded(params: {
    recruiterUserIds: string[];
    candidateName: string;
    jobTitle: string;
    applicationId: string;
    jobId: string;
    status: "accepted" | "declined";
  }) {
    const targetUserIds = await this.resolveRecruiterUserIds(params.recruiterUserIds, params.jobId);
    const isAccepted = params.status === "accepted";
    const subject = `Offer ${isAccepted ? "Accepted 🎉" : "Declined"}: ${params.candidateName}`;
    const body = `${params.candidateName} has ${params.status} the job offer for ${params.jobTitle}.`;

    let success = true;
    for (const recruiterId of targetUserIds) {
      const res = await this.createNotification({
        recipientUserId: recruiterId,
        recipientRole: "recruiter",
        type: isAccepted ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
        subject,
        body,
        entityType: "offer",
        entityId: params.applicationId,
        jobId: params.jobId,
        applicationId: params.applicationId,
        actionUrl: `/recruiter/pipeline?jobId=${params.jobId}&round=offer`,
        idempotencyKey: `offer_resp:${params.applicationId}:${params.status}`,
      });
      if (!res) success = false;
    }
    return success;
  },

  /**
   * Helper: Critical System / Gemini Failure -> Admin Notification
   */
  async notifySystemFailure(params: {
    adminUserIds: string[];
    title: string;
    errorMessage: string;
    context?: Record<string, any>;
  }) {
    let success = true;
    for (const adminId of params.adminUserIds) {
      const res = await this.createNotification({
        recipientUserId: adminId,
        recipientRole: "admin",
        type: "SYSTEM_AI_FAILURE",
        subject: `Operational Alert: ${params.title}`,
        body: params.errorMessage.slice(0, 180),
        entityType: "system",
        entityId: `sys_${Date.now()}`,
        actionUrl: "/admin/security",
        metadata: params.context,
      });
      if (!res) success = false;
    }
    return success;
  },
};
