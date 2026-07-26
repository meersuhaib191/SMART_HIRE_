import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAppClient } from "@/utils/supabase/application";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { stageTransitionService } from "@/services/stage-transition-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const supabase = await createClient();
    const appClient = await createAppClient();
    const assessmentClient = await createAssessmentClient();

    // 1. Authorize recruiter
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const {
      applicationId,
      scheduledAt,
      durationMinutes = 60,
      focusTopics = "",
    }: {
      applicationId: string;
      scheduledAt?: string;
      durationMinutes?: number;
      focusTopics?: string;
    } = body;

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    // 2. Fetch Application
    const { data: app, error: appErr } = await appClient
      .from("applications")
      .select("id, candidate_id, job_id")
      .eq("id", applicationId)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // 3. Find AI assessment template for job
    const { data: job } = await supabase
      .schema("job")
      .from("jobs")
      .select("ai_interview_assessment_id")
      .eq("id", jobId)
      .maybeSingle();

    let assessmentId = job?.ai_interview_assessment_id;
    if (!assessmentId) {
      const { data: tmpl } = await assessmentClient
        .from("assessments")
        .select("id")
        .ilike("title", "%AI%")
        .limit(1)
        .maybeSingle();
      assessmentId = tmpl?.id;
    }

    if (!assessmentId) {
      return NextResponse.json({ error: "No AI Interview template found for this position" }, { status: 400 });
    }

    // 4. Create a NEW Assignment row for attempt history auditability
    const scheduledStart = scheduledAt || new Date(Date.now() + 15 * 60000).toISOString();

    const { data: newAssign, error: assignErr } = await assessmentClient
      .from("assignments")
      .insert({
        application_id: applicationId,
        assessment_id: assessmentId,
        candidate_id: app.candidate_id,
        scheduled_start_at: scheduledStart,
        status: "assigned",
      })
      .select("id")
      .single();

    if (assignErr || !newAssign) {
      // Fallback: If unique constraint on (application_id, assessment_id), update assignment status to assigned
      await assessmentClient
        .from("assignments")
        .update({
          scheduled_start_at: scheduledStart,
          status: "assigned",
        })
        .eq("application_id", applicationId);
    }

    // Update application stage to interview if needed
    await appClient
      .from("applications")
      .update({
        status: "interview",
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    // Send candidate notification
    await stageTransitionService.notifyCandidate({
      candidateId: app.candidate_id,
      title: "New AI Interview Attempt Scheduled",
      message: `A new AI Interview attempt has been scheduled for your application. Scheduled start: ${new Date(scheduledStart).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`,
    });

    logger.info(`[Re-interview Scheduler] Created new AI Interview attempt for Application ${applicationId}`);

    return NextResponse.json({
      success: true,
      assignmentId: newAssign?.id || applicationId,
      scheduledStart,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error scheduling re-interview", err);
    return NextResponse.json({ error: "Failed to schedule re-interview", message }, { status: 500 });
  }
}
