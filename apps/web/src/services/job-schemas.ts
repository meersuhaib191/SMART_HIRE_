import { z } from "zod";

/**
 * Job Creation Validation Schema
 */
export const jobCreateSchema = z
  .object({
    title: z.string().min(1, "Job title is required").max(255),
    description: z.string().min(1, "Job description is required"),
    companyId: z.string().min(1, "Company ID is required"),
    departmentId: z.string().optional().nullable(),
    recruiterId: z.string().optional().nullable(),
    location: z.string().max(150).optional().nullable(),
    type: z.enum(["full-time", "part-time", "contract", "internship"]),
    status: z.enum(["draft", "published", "closed"]).default("draft"),
    salaryMin: z.number().nonnegative("Minimum salary cannot be negative").optional().nullable(),
    salaryMax: z.number().nonnegative("Maximum salary cannot be negative").optional().nullable(),
    experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]),
    category: z.string().max(100).optional().nullable(),
    benefits: z.array(z.string()).default([]),
    mcqAssessmentId: z.string().uuid("Invalid MCQ assessment ID").optional().nullable(),
    codingAssessmentId: z.string().uuid("Invalid coding assessment ID").optional().nullable(),
    applicationDeadline: z.string().optional().nullable(),
    publishedAt: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.salaryMin !== undefined && data.salaryMax !== undefined && data.salaryMin !== null && data.salaryMax !== null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    {
      message: "Maximum salary must be greater than or equal to minimum salary",
      path: ["salaryMax"],
    }
  );

/**
 * Job Update Validation Schema (Partial of creation constraints)
 */
export const jobUpdateSchema = z
  .object({
    title: z.string().min(1, "Job title is required").max(255).optional(),
    description: z.string().min(1, "Job description is required").optional(),
    departmentId: z.string().uuid("Invalid department ID format").optional().nullable(),
    location: z.string().max(150).optional().nullable(),
    type: z.enum(["full-time", "part-time", "contract", "internship"]).optional(),
    status: z.enum(["draft", "published", "closed"]).optional(),
    salaryMin: z.number().nonnegative("Minimum salary cannot be negative").optional().nullable(),
    salaryMax: z.number().nonnegative("Maximum salary cannot be negative").optional().nullable(),
    experienceLevel: z.enum(["entry", "mid", "senior", "lead", "executive"]).optional(),
    category: z.string().max(100).optional().nullable(),
    benefits: z.array(z.string()).optional(),
    mcqAssessmentId: z.string().uuid("Invalid MCQ assessment ID").optional().nullable(),
    codingAssessmentId: z.string().uuid("Invalid coding assessment ID").optional().nullable(),
    applicationDeadline: z.string().optional().nullable(),
    publishedAt: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.salaryMin !== undefined && data.salaryMax !== undefined && data.salaryMin !== null && data.salaryMax !== null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    {
      message: "Maximum salary must be greater than or equal to minimum salary",
      path: ["salaryMax"],
    }
  );
