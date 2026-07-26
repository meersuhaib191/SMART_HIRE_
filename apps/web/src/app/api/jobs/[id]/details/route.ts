import { NextRequest, NextResponse } from "next/server";
import { createJobClient } from "@/utils/supabase/job";
import { createOrgClient } from "@/utils/supabase/organization";
import { logger } from "@smarthire/logger";

/**
 * GET /api/jobs/[id]/details
 * Fetches job + company + recruiter details for candidate portal and public views
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const rawJobId = resolvedParams?.id;
    const jobId = rawJobId ? String(rawJobId).trim() : "";

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const jobClient = await createJobClient();

    // 1. Fetch the job
    let { data: job, error: jobErr } = await jobClient
      .from("jobs")
      .select("id, title, category, location, type, description, company_id, recruiter_id, status, experience_level, salary_min, salary_max, application_deadline, created_at")
      .eq("id", jobId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!job) {
      // Fallback: search without deleted_at constraint in case of legacy schema flags
      const { data: fallbackJob } = await jobClient
        .from("jobs")
        .select("id, title, category, location, type, description, company_id, recruiter_id, status, experience_level, salary_min, salary_max, application_deadline, created_at")
        .eq("id", jobId)
        .maybeSingle();
      job = fallbackJob;
    }

    if (!job) {
      logger.warn(`[/api/jobs/${jobId}/details] Job record not found`);
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const orgClient = await createOrgClient();

    // 2. Fetch company
    let company = null;
    if (job.company_id) {
      const { data: comp } = await orgClient
        .from("companies")
        .select("id, name, slug, domain, logo_url, description, industry, city, country")
        .eq("id", job.company_id)
        .maybeSingle();

      if (comp) {
        company = {
          name: comp.name,
          domain: comp.domain || "",
          logo_url: comp.logo_url || "",
          description: comp.description || "",
          location: [comp.city, comp.country].filter(Boolean).join(", ") || job.location || "",
          industry: comp.industry || "Technology",
        };
      }
    }

    // 3. Fetch recruiter
    let recruiter = null;
    if (job.recruiter_id) {
      const { data: rec } = await orgClient
        .from("recruiters")
        .select("id, first_name, last_name, email, title, role")
        .eq("id", job.recruiter_id)
        .maybeSingle();

      if (rec) {
        const fullName =
          [rec.first_name, rec.last_name].filter(Boolean).join(" ").trim() ||
          rec.email ||
          "Hiring Lead";
        const roleLabel = rec.role
          ? rec.role.charAt(0).toUpperCase() + rec.role.slice(1)
          : "Recruiter";

        recruiter = {
          name: fullName,
          title: rec.title || `${roleLabel} · Talent Acquisition`,
          email: rec.email || "",
        };
      }
    }

    return NextResponse.json({ job, company, recruiter });
  } catch (err) {
    logger.error("[/api/jobs/[id]/details] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
