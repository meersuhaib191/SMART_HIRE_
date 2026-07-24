import { z } from "zod";

/**
 * Job Application Submission Validation Schema
 */
export const applyJobSchema = z.object({
  jobId: z.string().uuid("Invalid job ID format"),
  candidateId: z.string().uuid("Invalid candidate ID format"),
  resumeId: z.string().uuid("Invalid resume ID format").optional().nullable(),
});

/**
 * Application Pipeline Status Update Validation Schema
 */
export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    "applied",
    "screening",
    "mcq",
    "coding",
    "interview",
    "recruiter_review",
    "zoom_interview",
    "offer_sent",
    "offered",
    "offer_accepted",
    "joined",
    "rejected",
    "withdrawn",
  ]),
  notes: z.string().max(2000, "Notes cannot exceed 2000 characters").optional().nullable(),
  rejection_stage: z.string().optional().nullable(),
});
