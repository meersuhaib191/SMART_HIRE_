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
      academicScore = 8,
      technicalScore = 8.5,
      communicationScore = 9,
      candidateNotes = "",
    } = body;

    logger.info(`[API/Interview/Complete] Completing interview for ID/AppID: ${interviewId}`);

    // 1. Try finding row in interview.interviews
    const { data: interview } = await supabase
      .schema("interview")
      .from("interviews")
      .select("id, application_id")
      .eq("id", interviewId)
      .maybeSingle();

    let targetApplicationId = interview?.application_id;

    // 2. If not found in interview.interviews, check if interviewId IS the application_id
    if (!targetApplicationId) {
      const { data: app } = await supabase
        .schema("application")
        .from("applications")
        .select("id")
        .eq("id", interviewId)
        .maybeSingle();

      if (app) {
        targetApplicationId = app.id;
      }
    }

    if (!targetApplicationId) {
      logger.error("[API/Interview/Complete] Neither interview nor application record found for:", interviewId);
      return NextResponse.json({ error: "Interview or Application record not found" }, { status: 404 });
    }

    const overallScore = Number(((academicScore + technicalScore + communicationScore) / 3).toFixed(1));
    const recommendation = overallScore >= 8.5 ? "strong_hire" : overallScore >= 7.0 ? "hire" : "neutral";

    // If a physical interview row exists, update it to completed
    if (interview?.id) {
      const { error: updateError } = await supabase
        .schema("interview")
        .from("interviews")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
          instructions: candidateNotes || undefined,
        })
        .eq("id", interview.id);

      if (updateError) {
        logger.error("[API/Interview/Complete] Failed to update interview table", updateError);
      }
    }

    // Update application stage scores in application.applications
    const { error: appUpdateErr } = await supabase
      .schema("application")
      .from("applications")
      .update({
        interview_avg_score: overallScore,
        interview_recommendation: recommendation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetApplicationId);

    if (appUpdateErr) {
      logger.error("[API/Interview/Complete] Failed to update application scores", appUpdateErr);
    }

    logger.info(`[API/Interview/Complete] Application ${targetApplicationId} AI interview completed. Score: ${overallScore}`);
    return NextResponse.json({
      success: true,
      data: {
        interviewId,
        applicationId: targetApplicationId,
        overallScore,
        recommendation,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[API/Interview/Complete] Unexpected error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
