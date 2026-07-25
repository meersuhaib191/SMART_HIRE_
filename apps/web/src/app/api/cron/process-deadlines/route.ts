import { NextRequest, NextResponse } from "next/server";
import { createBrowserClient } from "@supabase/ssr";
import { stageTransitionService } from "@/services/stage-transition-service";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const jobClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "job" } });
const appClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "application" } });

export const dynamic = "force-dynamic";

/**
 * GET/POST: Process expired job application deadlines automatically.
 * Moves all eligible candidates in the initial 'applied' stage to 'screening' (ATS Screening).
 * Idempotent, safe to run via cron or manual trigger.
 */
export async function GET(request: NextRequest) {
  return handleProcessDeadlines(request);
}

export async function POST(request: NextRequest) {
  return handleProcessDeadlines(request);
}

async function handleProcessDeadlines(request: NextRequest) {
  const startTime = Date.now();
  logger.info("[ProcessDeadlines] Starting background job deadline processing...");

  try {
    const nowIso = new Date().toISOString();

    // 1. Fetch published jobs with expired deadlines that have not been processed
    const { data: expiredJobs, error: jobErr } = await jobClient
      .from("jobs")
      .select("id, title, application_deadline, company_id, status, deadline_processed")
      .eq("status", "published")
      .is("deleted_at", null)
      .lt("application_deadline", nowIso);

    if (jobErr) {
      logger.error("[ProcessDeadlines] Error fetching expired jobs", jobErr);
      return NextResponse.json({ error: "Failed to query expired jobs", details: jobErr }, { status: 500 });
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired jobs pending deadline processing",
        processedJobsCount: 0,
        movedCandidatesCount: 0,
      });
    }

    let totalMovedCandidates = 0;
    const processedJobDetails: Array<{ jobId: string; title: string; movedCount: number }> = [];

    for (const job of expiredJobs) {
      // 2. Fetch applications for this job still in initial 'applied' status
      const { data: eligibleApps, error: appErr } = await appClient
        .from("applications")
        .select("id, candidate_id, status")
        .eq("job_id", job.id)
        .eq("status", "applied")
        .is("deleted_at", null);

      if (appErr) {
        logger.error(`[ProcessDeadlines] Error fetching applications for job ${job.id}`, appErr);
        continue;
      }

      let jobMovedCount = 0;

      if (eligibleApps && eligibleApps.length > 0) {
        for (const app of eligibleApps) {
          const result = await stageTransitionService.transitionStage({
            applicationId: app.id,
            destinationStage: "screening",
            notes: "Automatic transition: Job application deadline reached",
          });

          if (result.success) {
            jobMovedCount++;
            totalMovedCandidates++;
          }
        }
      }

      // 3. Mark job deadline as processed
      await jobClient
        .from("jobs")
        .update({
          deadline_processed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      processedJobDetails.push({
        jobId: job.id,
        title: job.title,
        movedCount: jobMovedCount,
      });
    }

    const durationMs = Date.now() - startTime;
    logger.info(`[ProcessDeadlines] Processed ${expiredJobs.length} expired jobs. Moved ${totalMovedCandidates} candidates to ATS Screening in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      processedJobsCount: expiredJobs.length,
      movedCandidatesCount: totalMovedCandidates,
      durationMs,
      details: processedJobDetails,
    });
  } catch (err: unknown) {
    logger.error("[ProcessDeadlines] Unexpected failure during deadline processing", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Deadline processing failed", message }, { status: 500 });
  }
}
