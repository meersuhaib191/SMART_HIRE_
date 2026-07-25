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

    // 2. Fetch Job details first
    const { data: job } = await jobClient
      .from("jobs")
      .select("id, title, description, company_id")
      .eq("id", jobId)
      .single();

    const body = await request.json().catch(() => ({}));
    const {
      candidateIds,
      applicationIds,
      scheduledStartAt,
      durationMinutes,
      focusTopics,
      focusInstructions,
      title,
    } = body;

    const effectiveFocusTopics = (focusTopics || focusInstructions || "").toString().trim();
    const effectiveDurationMinutes = (durationMinutes && !isNaN(Number(durationMinutes))) ? Math.max(10, Number(durationMinutes)) : 60;
    const assessmentTitle = title || "AI Live Technical Interview";

    if (scheduledStartAt) {
      const startTime = new Date(scheduledStartAt).getTime();
      if (isNaN(startTime) || startTime < Date.now() - 5 * 60 * 1000) {
        return NextResponse.json({ error: "Please select a future interview date and time." }, { status: 400 });
      }
    }

    const { data: recruiterProfile } = await appClient
      .schema("recruiter")
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyId = job.company_id || recruiterProfile?.company_id;

    if (!companyId) {
      return NextResponse.json({ error: "Company organization ID not found for this job posting" }, { status: 400 });
    }

    // 3. Find or create AI Interview Assessment Template
    const { data: existingAssessments } = await assessmentClient
      .from("assessments")
      .select("id")
      .eq("company_id", companyId)
      .ilike("title", "%AI Technical Interview%")
      .limit(1);

    let finalAssessmentId = existingAssessments?.[0]?.id;

    if (!finalAssessmentId) {
      const { data: newAss, error: createErr } = await assessmentClient
        .from("assessments")
        .insert({
          company_id: companyId,
          title: assessmentTitle,
          description: effectiveFocusTopics
            ? `Focus Topics: ${effectiveFocusTopics}`
            : `Real-time conversational AI Technical Interview for ${job.title}`,
          duration_minutes: effectiveDurationMinutes,
          passing_percentage: 60,
          status: "published",
        })
        .select("id")
        .maybeSingle();

      if (newAss?.id) {
        finalAssessmentId = newAss.id;
      } else {
        logger.warn("[Schedule AI Interview] Template insert warning", createErr);
        // Fallback: try fetching any assessment record for this company
        const { data: fallbackAss } = await assessmentClient
          .from("assessments")
          .select("id")
          .eq("company_id", companyId)
          .limit(1);
        finalAssessmentId = fallbackAss?.[0]?.id || "00000000-0000-0000-0000-000000000000";
      }
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

    // 5. Upsert assignments & update application status to 'interview'
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
      const { error: assignErr } = await assessmentClient
        .from("assignments")
        .upsert({
          company_id: companyId,
          assessment_id: finalAssessmentId,
          application_id: app.id,
          candidate_id: app.candidate_id,
          status: "assigned",
          scheduled_start_at: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : new Date().toISOString(),
          attempts_count: 0,
        })
        .select("id")
        .maybeSingle();

      if (assignErr) {
        logger.warn(`[Schedule AI Interview] Assignment upsert warning for app ${app.id}`, assignErr);
      }

      assignmentsCreated.push(app.id);

      // Update application stage status to 'interview'
      await appClient
        .from("applications")
        .update({
          status: "interview",
          updated_at: new Date().toISOString(),
        })
        .eq("id", app.id);
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
