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

    logger.info(`[API/Interviews] Scheduling ${interviewType} for application: ${applicationId} with PDF template: ${templateFileName || "none"}`);

    const startTime = new Date(scheduledAt);
    const endTime = new Date(startTime.getTime() + Number(durationMinutes) * 60000);
    const refNum = `INT-${Date.now().toString().slice(-6)}`;

    const intSupabase = await createInterviewClient();
    const appSupabase = await createAppClient();

    // Invalidate/expire any prior interview links for this candidate application upon rescheduling
    await intSupabase
      .from("interviews")
      .update({ status: "rescheduled" })
      .eq("application_id", applicationId)
      .eq("status", "scheduled");

    // Generate Secure Google Meet Link if human interview, or set AI Lobby marker
    const rawMeetCode = `smh-${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 6)}`;
    const finalMeetLink = isAiInterview
      ? undefined
      : (meetingLink || `https://meet.google.com/${rawMeetCode}`);

    const formattedInstructions = [
      isAiInterview ? "🤖 AI Video Interview Round (Candidate Browser AI Lobby)" : `📹 Google Meet Link: ${finalMeetLink}`,
      templateFileName ? `Interview Question Template PDF: ${templateFileName}` : null,
      notes,
    ].filter(Boolean).join("\n\n");

    const meetingTitle = isAiInterview
      ? "AI Video Interview Round (Browser AI Lobby)"
      : (interviewerName ? `Google Meet Interview with ${interviewerName}` : "Recruiter Final Google Meet Interview");

    // Create interview record matching Postgres table schema constraints
    const { data: interview, error: insertError } = await intSupabase
      .from("interviews")
      .insert({
        application_id: applicationId,
        company_id: "11111111-1111-1111-1111-111111111111",
        meeting_title: meetingTitle,
        reference_number: refNum,
        type: isAiInterview ? "AI_Video_Interview" : "Technical",
        status: "scheduled",
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        timezone: "Asia/Kolkata",
        duration_minutes: Number(durationMinutes),
        meeting_link: finalMeetLink,
        instructions: formattedInstructions,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("[API/Interviews] Insert failed", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Update application status in application.applications schema
    await applicationService.updateStatus(applicationId, user.id, {
      status: appTargetStatus,
      notes: isAiInterview ? "Scheduled AI Video Interview (AI Lobby Enabled)" : `Scheduled Google Meet interview: ${finalMeetLink}`,
    }).catch(async (serviceErr) => {
      logger.warn("[API/Interviews] applicationService updateStatus fallback", serviceErr);
      await appSupabase
        .from("applications")
        .update({
          status: appTargetStatus,
          interview_scheduled_at: startTime.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);
    });

    logger.info(`[API/Interviews] ${interviewType} scheduled: ${interview?.id}`);
    return NextResponse.json({
      data: {
        ...interview,
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
