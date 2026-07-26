import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { jobService } from "@/services/job-service";
import { logger } from "@smarthire/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET: Retrieve single job posting details
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const rawJobId = resolvedParams?.id;
    const jobId = rawJobId ? String(rawJobId).trim() : "";

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    logger.info(`API: Fetching details for job: ${jobId}`);

    const job = await jobService.getJobDetails(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    return NextResponse.json({ data: job });
  } catch (err) {
    logger.error("API error in job details GET route", err);
    return NextResponse.json({ error: "Failed to retrieve job details" }, { status: 500 });
  }
}

/**
 * PATCH: Edit job posting parameters
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: jobId } = await params;

    // Auth must use default-schema client; custom-schema clients bypass auth
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    logger.info(`API: Recruiter ${user.id} updating job posting: ${jobId}`);

    const updatedJob = await jobService.editJob(jobId, body);
    return NextResponse.json({ data: updatedJob });
  } catch (err: unknown) {
    logger.error("API error in job update PATCH route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Validation or database update failed", message }, { status: 400 });
  }
}

/**
 * DELETE: Soft delete job posting
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id: jobId } = await params;

    // Auth must use default-schema client; custom-schema clients bypass auth
    const authClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    logger.info(`API: Recruiter ${user.id} soft deleting job: ${jobId}`);
    await jobService.deleteJob(jobId);

    return NextResponse.json({ success: true, message: "Job posting soft deleted" });
  } catch (err) {
    logger.error("API error in job deletion DELETE route", err);
    return NextResponse.json({ error: "Failed to delete job posting" }, { status: 500 });
  }
}
