import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { jobService } from "@/services/job-service";
import { logger } from "@smarthire/logger";

/**
 * GET: List job postings (public/recruiter listings)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get("status");
    const status =
      statusParam === "draft" || statusParam === "published" || statusParam === "closed"
        ? statusParam
        : undefined;

    const category = searchParams.get("category") || undefined;
    const location = searchParams.get("location") || undefined;

    const typeParam = searchParams.get("type");
    const type =
      typeParam === "full-time" ||
      typeParam === "part-time" ||
      typeParam === "contract" ||
      typeParam === "internship"
        ? typeParam
        : undefined;

    logger.info("API: Fetching job postings list");

    const jobs = await jobService.listJobs({
      status,
      category,
      location,
      type,
    });

    return NextResponse.json({ data: jobs });
  } catch (err) {
    logger.error("API error in jobs list GET route", err);
    return NextResponse.json({ error: "Failed to list job postings" }, { status: 500 });
  }
}

/**
 * POST: Create a new job posting
 * Enforces status: "draft" or "published"
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      logger.warn("API: Unauthorized job creation attempt");
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const targetStatus = body.status === "published" ? "published" : "draft";

    if (targetStatus === "published") {
      const deadline = body.applicationDeadline || body.application_deadline;
      if (!deadline) {
        return NextResponse.json(
          { error: "Validation error", message: "Application deadline is required to publish a job." },
          { status: 400 }
        );
      }
      if (new Date(deadline) <= new Date()) {
        return NextResponse.json(
          { error: "Validation error", message: "Application deadline must be a valid future date/time." },
          { status: 400 }
        );
      }
    }

    const DEFAULT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
    const DEFAULT_RECRUITER_ID = "33333333-3333-3333-3333-333333333333";
    let companyId = body.companyId || undefined;
    let recruiterId = body.recruiterId || undefined;

    if (!companyId || !recruiterId) {
      try {
        const adminSupabase = createAdminClient();
        const { data: recruiter } = await adminSupabase
          .schema("organization")
          .from("recruiters")
          .select("id, company_id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (recruiter) {
          if (!companyId && recruiter.company_id) companyId = recruiter.company_id;
          if (!recruiterId && recruiter.id) recruiterId = recruiter.id;
        }
      } catch (e) {
        logger.error("Failed to auto-resolve company/recruiter with admin client", e);
      }
    }

    if (!companyId) {
      companyId = DEFAULT_COMPANY_ID;
    }
    if (!recruiterId) {
      recruiterId = DEFAULT_RECRUITER_ID;
    }

    logger.info(`API: Recruiter ${user.id} is creating a job posting with status: ${targetStatus}`);

    const payload = {
      ...body,
      companyId,
      recruiterId,
      status: targetStatus,
      published_at: targetStatus === "published" ? new Date().toISOString() : null,
    };

    const jobRecord = await jobService.createJob(payload);
    return NextResponse.json({ data: jobRecord }, { status: 201 });
  } catch (err: unknown) {
    logger.error("API error in jobs creation POST route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Validation or database insert failed", message }, { status: 400 });
  }
}
