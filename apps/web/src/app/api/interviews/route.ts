import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { logger } from "@smarthire/logger";

/**
 * POST: Schedule an interview for an application from the Recruiter Kanban Pipeline
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
    } = body;

    if (!applicationId || !scheduledAt) {
      return NextResponse.json({ error: "applicationId and scheduledAt are required" }, { status: 400 });
    }

    logger.info(`[API/Interviews] Scheduling interview for application: ${applicationId}`);

    const startTime = new Date(scheduledAt);
    const endTime = new Date(startTime.getTime() + Number(durationMinutes) * 60000);
    const refNum = `INT-${Date.now().toString().slice(-6)}`;

    // Create interview record matching Postgres table schema constraints
    const { data: interview, error: insertError } = await supabase
      .schema("interview")
      .from("interviews")
      .insert({
        application_id: applicationId,
        company_id: "11111111-1111-1111-1111-111111111111",
        meeting_title: interviewerName ? `Interview with ${interviewerName}` : "AI Technical Video Interview",
        reference_number: refNum,
        type: "Technical",
        status: "scheduled",
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        timezone: "Asia/Kolkata",
        duration_minutes: Number(durationMinutes),
        meeting_link: meetingLink || undefined,
        instructions: notes || undefined,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("[API/Interviews] Insert failed", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Update application status to 'interview'
    await supabase
      .schema("application")
      .from("applications")
      .update({
        status: "interview",
        interview_scheduled_at: startTime.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    logger.info(`[API/Interviews] Interview scheduled: ${interview?.id}`);
    return NextResponse.json({ data: interview }, { status: 201 });
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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");

    const query = supabase.schema("interview").from("interviews").select("*");
    if (applicationId) {
      query.eq("application_id", applicationId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
