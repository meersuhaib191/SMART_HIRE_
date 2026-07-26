import { z } from "zod";

/**
 * Company Creation Validation Schema
 */
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(255),
  slug: z.string().optional().nullable(),
  domain: z.string().max(255).optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL format").or(z.literal("")).optional().nullable(),
  // Onboarding Fields
  industry: z.string().max(100).optional().nullable(),
  companySize: z.string().max(50).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email format").or(z.literal("")).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  bannerUrl: z.string().url("Invalid banner URL format").or(z.literal("")).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
});

/**
 * Company Settings & Branding Update Validation Schema
 */
export const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  domain: z.string().max(255).optional().nullable(),
  logoUrl: z.string().url().max(512).optional().nullable(),
  // Onboarding Fields
  industry: z.string().max(100).optional().nullable(),
  companySize: z.string().max(50).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email format").or(z.literal("")).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  bannerUrl: z.string().url().max(512).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  // Settings & Branding
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid Hex color code")
    .optional()
    .nullable(),
  accentColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid Hex color code")
    .optional()
    .nullable(),
  subscriptionTier: z.enum(["free", "growth", "enterprise"]).optional(),
});

/**
 * Department Creation Validation Schema
 */
export const createDepartmentSchema = z.object({
  companyId: z.string().uuid("Invalid company ID format"),
  name: z.string().min(1, "Department name is required").max(150),
});

/**
 * Department Update Validation Schema
 */
export const updateDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(150),
});

/**
 * Recruiter Invitation Validation Schema
 */
export const inviteRecruiterSchema = z.object({
  companyId: z.string().uuid("Invalid company ID format"),
  email: z.string().email("Invalid invitation email format"),
  role: z.enum(["recruiter", "hiring_manager", "company-admin"]),
});
