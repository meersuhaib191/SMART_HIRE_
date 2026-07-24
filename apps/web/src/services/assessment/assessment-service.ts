import { z } from "zod";
import { assessmentRepository } from "./assessment-repository";
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  assignAssessmentSchema,
  saveProgressSchema,
} from "./assessment-schemas";
import {
  AssessmentTemplate,
  AssessmentAssignment,
  CandidateAttempt,
  DetailedResults,
  SectionBreakdown,
} from "./interfaces/assessment.interface";
import { logger } from "@smarthire/logger";

export const AssessmentService = {
  // ─── Templates ────────────────────────────────────────────────────────────

  createTemplate: async (
    companyId: string,
    userId: string,
    rawInput: unknown
  ): Promise<AssessmentTemplate> => {
    logger.info(`[AssessmentService] createTemplate for company: ${companyId}`);
    const input = createAssessmentSchema.parse(rawInput);
    const { questions, ...templateData } = input;

    const template = await assessmentRepository.createTemplate(companyId, userId, templateData);

    if (questions && questions.length > 0) {
      const dbQ = await assessmentRepository.syncQuestions(template.id, questions);
      template.questions = dbQ;
    }

    return template;
  },

  getTemplate: async (id: string): Promise<AssessmentTemplate> => {
    logger.info(`[AssessmentService] getTemplate: ${id}`);
    const template = await assessmentRepository.getTemplateById(id);
    if (!template) {
      throw new Error(`Assessment template ${id} not found`);
    }
    return template;
  },

  updateTemplate: async (id: string, rawInput: unknown): Promise<AssessmentTemplate> => {
    logger.info(`[AssessmentService] updateTemplate: ${id}`);
    const input = updateAssessmentSchema.parse(rawInput);

    // Verify it exists and is draft (cannot modify published/archived)
    const existing = await assessmentRepository.getTemplateById(id, false);
    if (!existing) {
      throw new Error(`Assessment template ${id} not found`);
    }
    if (existing.status !== "draft" && !input.status) {
      throw new Error("Cannot update a published or archived template");
    }

    return assessmentRepository.updateTemplate(id, input);
  },

  archiveTemplate: async (id: string): Promise<void> => {
    logger.info(`[AssessmentService] archiveTemplate: ${id}`);
    const existing = await assessmentRepository.getTemplateById(id, false);
    if (!existing) {
      throw new Error(`Assessment template ${id} not found`);
    }
    await assessmentRepository.archiveTemplate(id);
  },

  publishTemplate: async (id: string): Promise<AssessmentTemplate> => {
    logger.info(`[AssessmentService] publishTemplate: ${id}`);
    const existing = await assessmentRepository.getTemplateById(id, true);
    if (!existing) {
      throw new Error(`Assessment template ${id} not found`);
    }
    if (!existing.questions || existing.questions.length === 0) {
      throw new Error("Cannot publish an assessment with no questions");
    }

    return assessmentRepository.updateTemplate(id, { status: "published" } as Partial<AssessmentTemplate>);
  },

  duplicateTemplate: async (
    id: string,
    companyId: string,
    userId: string
  ): Promise<AssessmentTemplate> => {
    logger.info(`[AssessmentService] duplicateTemplate: ${id}`);
    const existing = await assessmentRepository.getTemplateById(id, true);
    if (!existing) {
      throw new Error(`Assessment template ${id} not found`);
    }

    // Create a new draft copy
    const copyData: Partial<AssessmentTemplate> = {
      title: `Copy of ${existing.title}`,
      description: existing.description,
      durationMinutes: existing.durationMinutes,
      passingPercentage: existing.passingPercentage,
    };

    const duplicate = await assessmentRepository.createTemplate(companyId, userId, copyData);

    if (existing.questions && existing.questions.length > 0) {
      const newQuestions = existing.questions.map((q) => ({
        questionText: q.questionText,
        questionType: q.questionType,
        correctAnswer: q.correctAnswer,
        points: q.points,
        options: q.options,
        difficulty: q.difficulty,
        category: q.category,
        section: q.section,
      }));
      const dbQ = await assessmentRepository.syncQuestions(duplicate.id, newQuestions);
      duplicate.questions = dbQ;
    }

    return duplicate;
  },

  listTemplates: async (companyId: string): Promise<AssessmentTemplate[]> => {
    logger.info(`[AssessmentService] listTemplates for company: ${companyId}`);
    return assessmentRepository.listTemplates(companyId);
  },

  // ─── Assignments ──────────────────────────────────────────────────────────

  assignAssessment: async (companyId: string, rawInput: unknown): Promise<AssessmentAssignment> => {
    logger.info(`[AssessmentService] assignAssessment`);
    const input = assignAssessmentSchema.parse(rawInput);

    // Verify assessment is published
    const template = await assessmentRepository.getTemplateById(input.assessmentId, false);
    if (!template) {
      throw new Error(`Assessment template ${input.assessmentId} not found`);
    }
    if (template.status !== "published") {
      throw new Error("Cannot assign a template that is not published");
    }

    return assessmentRepository.createAssignment(companyId, input);
  },

  // ─── Attempts ─────────────────────────────────────────────────────────────

  startAttempt: async (candidateId: string, rawInput: unknown): Promise<CandidateAttempt> => {
    logger.info(`[AssessmentService] startAttempt for candidate: ${candidateId}`);
    const input = z.object({ assignmentId: z.string().uuid() }).parse(rawInput);

    const assignment = await assessmentRepository.getAssignmentById(input.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${input.assignmentId} not found`);
    }

    if (assignment.candidateId !== candidateId) {
      throw new Error("Access denied: Candidate mismatch");
    }

    // Check expiration
    if (assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) {
      await assessmentRepository.updateAssignmentAttempts(assignment.id, assignment.attemptsCount, "expired");
      throw new Error("Assessment link has expired");
    }

    // Check attempt limit
    if (assignment.attemptsCount >= assignment.attemptLimit) {
      throw new Error("Attempt limit exceeded for this assessment assignment");
    }

    // Create the attempt
    const attempt = await assessmentRepository.createAttempt(
      assignment.assessmentId,
      assignment.id,
      candidateId,
      assignment.applicationId || ""
    );

    // Increment attempt count on assignment
    await assessmentRepository.updateAssignmentAttempts(
      assignment.id,
      assignment.attemptsCount + 1,
      "in-progress"
    );

    return attempt;
  },

  saveProgress: async (candidateId: string, attemptId: string, rawInput: unknown): Promise<CandidateAttempt> => {
    logger.info(`[AssessmentService] saveProgress for attempt: ${attemptId}`);
    const input = saveProgressSchema.parse(rawInput);

    const attempt = await assessmentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    if (attempt.candidateId !== candidateId) {
      throw new Error("Access denied: Candidate mismatch");
    }

    if (attempt.status !== "started" && attempt.status !== "in-progress") {
      throw new Error("Cannot save progress for an inactive or completed attempt");
    }

    return assessmentRepository.updateAttemptProgress(attemptId, input.answers, input.timeSpentSeconds);
  },

  submitAttempt: async (
    candidateId: string,
    attemptId: string,
    rawInput: unknown
  ): Promise<CandidateAttempt> => {
    logger.info(`[AssessmentService] submitAttempt: ${attemptId}`);
    const input = z.object({
      answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
      timeSpentSeconds: z.number().int().min(0).optional(),
    }).parse(rawInput);

    const attempt = await assessmentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    if (attempt.candidateId !== candidateId) {
      throw new Error("Access denied: Candidate mismatch");
    }

    if (attempt.status !== "started" && attempt.status !== "in-progress") {
      throw new Error("Attempt is already finalized");
    }

    const template = await assessmentRepository.getTemplateById(attempt.assessmentId, true, true);
    if (!template || !template.questions) {
      throw new Error("Assessment template or questions missing");
    }

    // Merge incoming answers with already saved ones
    const finalAnswers = { ...attempt.answers, ...(input.answers ?? {}) };
    const finalTimeSpent = input.timeSpentSeconds ?? attempt.timeSpentSeconds;

    // Check timeout
    const isTimeout = finalTimeSpent > (template.durationMinutes * 60 + 30); // 30s grace period
    const status = isTimeout ? "timed-out" : "completed";

    // Auto-Grading & Scoring
    let totalPointsPossible = 0;
    let totalPointsEarned = 0;

    const gradingResults: Record<string, { correct: boolean; pointsEarned: number; feedback?: string }> = {};
    const categoryEarnedPoints: Record<string, number> = {};
    const categoryMaxPoints: Record<string, number> = {};

    for (let qIdx = 0; qIdx < template.questions.length; qIdx++) {
      const q: any = template.questions[qIdx];
      totalPointsPossible += q.points;
      const category = q.category || "custom";

      categoryMaxPoints[category] = (categoryMaxPoints[category] || 0) + q.points;
      categoryEarnedPoints[category] = categoryEarnedPoints[category] || 0;

      // Resolve answer: try real UUID first, then positional fallback key "q-{n}" used by DEFAULT_10_QUESTIONS
      const candidateAns = finalAnswers[q.id] ?? finalAnswers[`q-${qIdx + 1}`];
      let correct = false;
      let pointsEarned = 0;

      if (candidateAns !== undefined && candidateAns !== null) {
        if (q.questionType === "mcq" || q.questionType === "true-false" || q.questionType === "short-answer") {
          // Compare strings (case-insensitive)
          const cleanCorrect = String(q.correctAnswer ?? "").trim().toLowerCase();
          const cleanCandidate = String(candidateAns).trim().toLowerCase();
          if (cleanCorrect && cleanCorrect === cleanCandidate) {
            correct = true;
            pointsEarned = q.points;
          }
        } else if (q.questionType === "multiple-select") {
          // Compare lists of strings
          const correctList = JSON.parse(q.correctAnswer || "[]").map((s: string) => s.trim().toLowerCase());
          const candidateList = (Array.isArray(candidateAns) ? candidateAns : [candidateAns]).map((s: string) => String(s).trim().toLowerCase());

          const match = correctList.length === candidateList.length &&
            correctList.every((val: string) => candidateList.includes(val));

          if (match) {
            correct = true;
            pointsEarned = q.points;
          }
        } else {
          // Coding and File Upload questions cannot be auto-graded natively in this step
          // Default to manual grading review (0 points initially, stores candidate response)
          correct = false;
          pointsEarned = 0;
        }
      }

      gradingResults[q.id] = { correct, pointsEarned };
      totalPointsEarned += pointsEarned;
      categoryEarnedPoints[category] += pointsEarned;
    }

    const scorePercentage = totalPointsPossible > 0 ? (totalPointsEarned / totalPointsPossible) * 100 : 0;
    const passed = scorePercentage >= template.passingPercentage;

    // Build section scores percentages
    const sectionScores: Record<string, number> = {};
    for (const cat of Object.keys(categoryMaxPoints)) {
      const max = categoryMaxPoints[cat];
      const earned = categoryEarnedPoints[cat];
      sectionScores[cat] = max > 0 ? Math.round((earned / max) * 100) : 0;
    }

    // Save final attempt results
    const finalized = await assessmentRepository.completeAttempt(
      attemptId,
      Math.round(scorePercentage * 10) / 10,
      passed,
      status,
      sectionScores,
      gradingResults
    );

    // Update assignment status to completed
    if (attempt.assignmentId) {
      await assessmentRepository.updateAssignmentAttempts(attempt.assignmentId, 1, "completed");
    }

    // Sync score to application.applications per-stage score columns
    if (attempt.applicationId) {
      try {
        const { applicationRepository } = await import("@/services/application-repository");
        const { jobRepository } = await import("@/services/job-repository");
        
        const appRecord = await applicationRepository.getApplicationById(attempt.applicationId);
        if (appRecord && appRecord.job_id) {
          const jobRecord = await jobRepository.getJobById(appRecord.job_id);
          if (jobRecord) {
            const isMcq = jobRecord.mcq_assessment_id === attempt.assessmentId;
            const isCoding = jobRecord.coding_assessment_id === attempt.assessmentId;

            if (isMcq) {
              await applicationRepository.updateStageScores(attempt.applicationId, {
                mcq_score: Math.round(scorePercentage * 10) / 10,
                mcq_total: 100,
                mcq_passed: passed,
              });
            } else if (isCoding) {
              await applicationRepository.updateStageScores(attempt.applicationId, {
                coding_score: Math.round(scorePercentage * 10) / 10,
                coding_total: 100,
                coding_passed: passed,
              });
            }
          }
        }
      } catch (err) {
        logger.error("[AssessmentService] Failed to sync attempt results to application status scores", err);
      }
    }

    return finalized;
  },

  getDetailedResults: async (userId: string, userRole: string, attemptId: string): Promise<DetailedResults> => {
    logger.info(`[AssessmentService] getDetailedResults: ${attemptId} by: ${userId}`);

    const attempt = await assessmentRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    // RBAC Check: Must be candidate owner or company recruiter
    if (userRole === "candidate" && attempt.candidateId !== userId) {
      throw new Error("Access denied to view results");
    }

    const template = await assessmentRepository.getTemplateById(attempt.assessmentId, true);
    if (!template || !template.questions) {
      throw new Error("Assessment template details not found");
    }

    // Calculate details
    let correctCount = 0;
    const sections: Record<string, { possible: number; earned: number }> = {};

    for (const q of template.questions) {
      const category = q.category || "custom";
      sections[category] = sections[category] || { possible: 0, earned: 0 };
      sections[category].possible += q.points;

      const grade = attempt.gradingResults[q.id];
      if (grade) {
        sections[category].earned += grade.pointsEarned;
        if (grade.correct) {
          correctCount++;
        }
      }
    }

    const sectionsBreakdown: SectionBreakdown[] = Object.entries(sections).map(([cat, val]) => ({
      category: cat,
      totalPointsPossible: val.possible,
      pointsEarned: val.earned,
      percentage: val.possible > 0 ? Math.round((val.earned / val.possible) * 100) : 0,
    }));

    return {
      attempt,
      assessment: template,
      totalQuestionsCount: template.questions.length,
      correctQuestionsCount: correctCount,
      sectionsBreakdown,
      timeLimitMinutes: template.durationMinutes,
      timeSpentSeconds: attempt.timeSpentSeconds,
    };
  },
};
