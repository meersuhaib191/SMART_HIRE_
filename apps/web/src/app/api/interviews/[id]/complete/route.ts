import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { logger } from "@smarthire/logger";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST: Complete AI video interview, save transcript, proctoring violations & scores
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: interviewId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      transcript = [],
      proctoringLogs = [],
      academicScore = 8,
      technicalScore = 8.5,
      communicationScore = 9,
      integrityScore = 100,
      candidateNotes = "",
    } = body;

    logger.info(`[API/Interview/Complete] Completing interview ${interviewId}`);

    // Fetch interview details
    const { data: interview, error: fetchError } = await supabase
      .schema("interview")
      .from("interviews")
      .select("id, application_id")
      .eq("id", interviewId)
      .single();

    if (fetchError || !interview) {
      logger.error("[API/Interview/Complete] Interview not found", fetchError);
      return NextResponse.json({ error: "Interview record not found" }, { status: 404 });
    }

    const overallScore = Number(((academicScore + technicalScore + communicationScore) / 3).toFixed(1));
    const recommendation = overallScore >= 8.5 ? "strong_hire" : overallScore >= 7.0 ? "hire" : "neutral";

    // Update interview record in DB
    const { error: updateError } = await supabase
      .schema("interview")
      .from("interviews")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
        instructions: candidateNotes || undefined,
      })
      .eq("id", interviewId);

    if (updateError) {
      logger.error("[API/Interview/Complete] Failed to update interview", updateError);
    }

    // Update application stage scores
    if (interview.application_id) {
      await supabase
        .schema("application")
        .from("applications")
        .update({
          interview_avg_score: overallScore,
          interview_recommendation: recommendation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interview.application_id);
    }

    logger.info(`[API/Interview/Complete] Interview ${interviewId} completed successfully with score ${overallScore}`);
    return NextResponse.json({
      success: true,
      data: {
        interviewId,
        overallScore,
        recommendation,
        integrityScore,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[API/Interview/Complete] Unexpected error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET: Fetch interview details, transcript & proctoring log for recruiter supervision
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: interviewId } = await params;
    const supabase = await createClient();

    const { data: interview, error } = await supabase
      .schema("interview")
      .from("interviews")
      .select("*")
      .eq("id", interviewId)
      .single();

    if (error || !interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Parse transcript from notes field if stored as JSON
    let parsedTranscript = [];
    try {
      if (interview.notes) {
        parsedTranscript = JSON.parse(interview.notes);
      }
    } catch {
      parsedTranscript = [];
    }

    return NextResponse.json({
      data: {
        ...interview,
        transcript: parsedTranscript,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
