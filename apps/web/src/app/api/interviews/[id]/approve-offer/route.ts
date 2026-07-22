import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { logger } from "@smarthire/logger";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST: Recruiter/Admin approves candidate based on interview performance and extends job offer
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: interviewId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { recruiterNotes = "" } = body;

    logger.info(`[API/Interview/ApproveOffer] Recruiter ${user.id} approving candidate for interview ${interviewId}`);

    // Fetch interview to get application_id
    const { data: interview, error: fetchErr } = await supabase
      .schema("interview")
      .from("interviews")
      .select("id, application_id")
      .eq("id", interviewId)
      .single();

    if (fetchErr || !interview || !interview.application_id) {
      return NextResponse.json({ error: "Interview or associated application not found" }, { status: 404 });
    }

    // Update application status to 'offered'
    const { error: appErr } = await supabase
      .schema("application")
      .from("applications")
      .update({
        status: "offered",
        interview_recommendation: "strong_hire",
        updated_at: new Date().toISOString(),
      })
      .eq("id", interview.application_id);

    if (appErr) {
      logger.error("[API/Interview/ApproveOffer] Application status update failed", appErr);
      return NextResponse.json({ error: appErr.message }, { status: 400 });
    }

    // Update interview record validation state
    await supabase
      .schema("interview")
      .from("interviews")
      .update({
        status: "completed",
        instructions: recruiterNotes ? `[ADMIN APPROVED] ${recruiterNotes}` : undefined,
      })
      .eq("id", interviewId);

    logger.info(`[API/Interview/ApproveOffer] Application ${interview.application_id} transitioned to OFFERED`);
    return NextResponse.json({
      success: true,
      message: "Candidate approved! Job offer extended.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[API/Interview/ApproveOffer] Error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
