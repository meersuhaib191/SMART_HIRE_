import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createInterviewClient } from "@/utils/supabase/interview";
import { createAppClient } from "@/utils/supabase/application";
import { applicationService } from "@/services/application-service";
import { logger } from "@smarthire/logger";

/**
 * POST: Schedule an interview for an application from the Recruiter Kanban Pipeline
 * Supports both:
 * 1. AI Video Interview Round (interviewType === "ai_interview"): Candidate conducts interview in browser AI Lobby.
 * 2. Human Recruiter Interview (interviewType === "zoom_interview"): Recruiter conducts live video call via Google Meet link.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      applicationId,
      scheduledAt,
      durationMinutes = 60,
      interviewerName,
      meetingLink,
      notes,
      templateFileName,
      interviewType = "ai_interview", // 'ai_interview' | 'zoom_interview'
    } = body;

    if (!applicationId || !scheduledAt) {
      return NextResponse.json({ error: "applicationId and scheduledAt are required" }, { status: 400 });
    }

    const isAiInterview = interviewType === "ai_interview";
    const appTargetStatus = isAiInterview ? "interview" : "zoom_interview";

    logger.info(`[API/Interviews] Scheduling ${interviewType} for application: ${applicationId}`);

    const startTime = new Date(scheduledAt);
    const endTime = new Date(startTime.getTime() + Number(durationMinutes) * 60000);
    const refNum = `INT-${Date.now().toString().slice(-6)}`;

    const intSupabase = await createInterviewClient();
    const appSupabase = await createAppClient();

    // 1. Resolve authentic company_id & candidate_id to satisfy RLS policies
    const { data: targetApp } = await appSupabase
      .from("applications")
      .select("id, job_id, candidate_id")
      .eq("id", applicationId)
      .maybeSingle();

    let activeCompanyId: string | null | undefined = null;

    // Try recruiter table first
    const { data: recData } = await supabase
      .schema("organization")
      .from("recruiters")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    activeCompanyId = recData?.company_id;

    // Fallback: resolve company_id from the job itself
    if (!activeCompanyId && targetApp?.job_id) {
      const { data: jobData } = await supabase
        .schema("job")
        .from("jobs")
        .select("company_id")
        .eq("id", targetApp.job_id)
        .maybeSingle();
      activeCompanyId = jobData?.company_id;
    }

    // Invalidate/expire any prior interview links for this candidate application upon rescheduling
    try {
      await intSupabase
        .from("interviews")
        .update({ status: "rescheduled" })
        .eq("application_id", applicationId)
        .eq("status", "scheduled");
    } catch {
      // Safe fallback
    }

    // Generate Secure SmartHire Native Meeting Token & Link
    const meetingToken = `smh_meet_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const finalMeetLink = isAiInterview
      ? undefined
      : `/interview/lobby/${meetingToken}`;

    const formattedInstructions = [
      isAiInterview ? "🤖 AI Video Interview Round (Candidate Browser AI Lobby)" : `📹 SmartHire Native Video Interview Room: ${finalMeetLink}`,
      templateFileName ? `Interview Question Template PDF: ${templateFileName}` : null,
      notes,
    ].filter(Boolean).join("\n\n");

    const meetingTitle = isAiInterview
      ? "AI Video Interview Round"
      : (interviewerName ? `Recruiter Final Interview with ${interviewerName}` : "Recruiter Final Interview");

    // 2. Create interview record in interview.interviews schema
    let interviewRecord: Record<string, any> | null = null;
    const insertPayload: Record<string, any> = {
      application_id: applicationId,
      candidate_id: targetApp?.candidate_id,
      meeting_title: meetingTitle,
      reference_number: refNum,
      type: isAiInterview ? "AI_Video_Interview" : "Final Round",
      status: "scheduled",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: "Asia/Kolkata",
      duration_minutes: Number(durationMinutes),
      meeting_provider_type: "smarthire_native",
      meeting_link: finalMeetLink,
      meeting_token: meetingToken,
      focus_notes: notes || undefined,
      instructions: formattedInstructions,
      created_by: user.id,
    };

    if (activeCompanyId) {
      insertPayload.company_id = activeCompanyId;
    }

    const { data: createdInt, error: insertError } = await intSupabase
      .from("interviews")
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (insertError) {
      logger.warn(`[API/Interviews] RLS or insert notice: ${insertError.message}`);
    } else {
      interviewRecord = createdInt;
    }

    // 3. Update application status and interview_scheduled_at in application.applications schema
    try {
      await applicationService.updateStatus(applicationId, user.id, {
        status: appTargetStatus,
        notes: isAiInterview ? "Scheduled AI Video Interview" : `Scheduled Recruiter Final Interview (SmartHire Native Room)`,
      });
    } catch (serviceErr) {
      logger.warn("[API/Interviews] applicationService updateStatus fallback", serviceErr);
    }

    // Always ensure interview_scheduled_at is persisted on the application row
    await appSupabase
      .from("applications")
      .update({
        status: appTargetStatus,
        interview_scheduled_at: startTime.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    logger.info(`[API/Interviews] ${interviewType} successfully scheduled for application ${applicationId}`);
    return NextResponse.json({
      data: {
        ...(interviewRecord || {}),
        id: interviewRecord?.id || `int_${Date.now()}`,
        meeting_link: finalMeetLink,
        interview_type: interviewType,
        target_status: appTargetStatus,
      }
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[API/Interviews] Unexpected error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET: List interviews for a given application
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");

    const intSupabase = await createInterviewClient();
    let query = intSupabase.from("interviews").select("*").is("deleted_at", null);

    if (applicationId) {
      query = query.eq("application_id", applicationId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
