import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { logger } from "@smarthire/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/recruiter/jobs/[id]/schedule-ai-interview
 *
 * Schedules or reschedules the AI Interview round for candidate applications.
 * Enforces server-authoritative duration_minutes (defaults to 60 minutes if unspecified).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: jobId } = await context.params;
    const appClient = await createAppClient();
    const jobClient = await createJobClient();
    const assessmentClient = await createAssessmentClient();

    // 1. Authenticate recruiter session
    const {
      data: { user },
      error: authError,
    } = await supabaseAuthUser(appClient);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { data: recruiterProfile } = await appClient
      .schema("recruiter")
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!recruiterProfile?.company_id) {
      return NextResponse.json({ error: "Recruiter organization profile not found" }, { status: 403 });
    }

    const body = await request.json();
    const {
      candidateIds,
      applicationIds,
      scheduledStartAt,
      durationMinutes,
      title,
    } = body;

    // DEFAULT DURATION: 60 MINUTES
    const effectiveDurationMinutes = durationMinutes ? Number(durationMinutes) : 60;
    const assessmentTitle = title || "AI Live Technical Interview";

    // 2. Fetch Job details
    const { data: job } = await jobClient
      .from("jobs")
      .select("id, title, description")
      .eq("id", jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 3. Find or create AI Interview Assessment Template
    const { data: existingAssessments } = await assessmentClient
      .from("assessments")
      .select("id")
      .eq("company_id", recruiterProfile.company_id)
      .eq("type", "ai_interview")
      .limit(1);

    let finalAssessmentId = existingAssessments?.[0]?.id;

    if (!finalAssessmentId) {
      const { data: newAss, error: createErr } = await assessmentClient
        .from("assessments")
        .insert({
          company_id: recruiterProfile.company_id,
          title: assessmentTitle,
          description: `Real-time conversational AI Technical Interview for ${job.title}`,
          type: "ai_interview",
          duration_minutes: effectiveDurationMinutes,
          pass_percentage: 60,
          created_by: recruiterProfile.id,
        })
        .select("id")
        .single();

      if (createErr || !newAss) {
        logger.error("Failed to create AI Interview assessment template", createErr);
        return NextResponse.json({ error: "Failed to initialize AI interview template" }, { status: 500 });
      }
      finalAssessmentId = newAss.id;
    } else {
      // Update duration on existing template
      await assessmentClient
        .from("assessments")
        .update({
          title: assessmentTitle,
          duration_minutes: effectiveDurationMinutes,
        })
        .eq("id", finalAssessmentId);
    }

    // 4. Fetch target applications (If applicationIds/candidateIds omitted, schedule ALL candidates for job)
    let targetApplications: any[] = [];
    if (Array.isArray(applicationIds) && applicationIds.length > 0) {
      const { data: apps } = await appClient
        .from("applications")
        .select("id, candidate_id")
        .in("id", applicationIds);
      targetApplications = apps || [];
    } else if (Array.isArray(candidateIds) && candidateIds.length > 0) {
      const { data: apps } = await appClient
        .from("applications")
        .select("id, candidate_id")
        .eq("job_id", jobId)
        .in("candidate_id", candidateIds);
      targetApplications = apps || [];
    } else {
      // Schedule ALL candidates for this job in 1 action!
      const { data: apps } = await appClient
        .from("applications")
        .select("id, candidate_id")
        .eq("job_id", jobId);
      targetApplications = apps || [];
    }

    if (targetApplications.length === 0) {
      return NextResponse.json({ error: "No matching candidate applications found to schedule" }, { status: 400 });
    }

    // 5. Upsert assignments & update application status to 'ai_interview'
    const assignmentsCreated: string[] = [];

    for (const app of targetApplications) {
      // Delete previous attempt if rescheduling so candidate can re-appear
      const { data: prevAssignments } = await assessmentClient
        .from("assignments")
        .select("id")
        .eq("application_id", app.id)
        .eq("assessment_id", finalAssessmentId);

      if (prevAssignments && prevAssignments.length > 0) {
        for (const pAssign of prevAssignments) {
          await assessmentClient
            .from("attempts")
            .delete()
            .eq("assignment_id", pAssign.id);
        }
      }

      // Upsert assignment record
      const { data: assign, error: assignErr } = await assessmentClient
        .from("assignments")
        .upsert({
          company_id: recruiterProfile.company_id,
          assessment_id: finalAssessmentId,
          application_id: app.id,
          candidate_id: app.candidate_id,
          type: "ai_interview",
          status: "scheduled",
          scheduled_start_at: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : new Date().toISOString(),
          attempts_count: 0,
        })
        .select("id")
        .single();

      if (!assignErr && assign) {
        assignmentsCreated.push(assign.id);

        // Update application stage status
        await appClient
          .from("applications")
          .update({
            status: "ai_interview",
            updated_at: new Date().toISOString(),
          })
          .eq("id", app.id);
      }
    }

    logger.info(`[Schedule AI Interview] Scheduled ${assignmentsCreated.length} candidates for Job ${jobId} (Duration: ${effectiveDurationMinutes}m)`);

    return NextResponse.json({
      success: true,
      scheduledCount: assignmentsCreated.length,
      durationMinutes: effectiveDurationMinutes,
      assessmentId: finalAssessmentId,
      scheduledStartAt: scheduledStartAt || new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error in schedule-ai-interview route", err);
    return NextResponse.json({ error: "Failed to schedule AI Interview", message }, { status: 500 });
  }
}

async function supabaseAuthUser(client: any) {
  return await client.auth.getUser();
}
