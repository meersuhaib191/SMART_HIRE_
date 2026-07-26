import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createInterviewClient } from "@/utils/supabase/interview";
import { createAppClient } from "@/utils/supabase/application";
import { MeetingService, RecruiterRubricEvaluation } from "@/services/interview/meeting-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      technicalScore = 80,
      problemSolvingScore = 80,
      communicationScore = 80,
      experienceScore = 80,
      judgmentScore = 80,
      technicalNotes,
      problemSolvingNotes,
      communicationNotes,
      experienceNotes,
      judgmentNotes,
      recommendation = "hire",
      overallNotes,
    } = body;

    const rubric: RecruiterRubricEvaluation = {
      technicalScore: Number(technicalScore),
      problemSolvingScore: Number(problemSolvingScore),
      communicationScore: Number(communicationScore),
      experienceScore: Number(experienceScore),
      judgmentScore: Number(judgmentScore),
      technicalNotes,
      problemSolvingNotes,
      communicationNotes,
      experienceNotes,
      judgmentNotes,
      recommendation,
      overallNotes,
    };

    const weightedScore = MeetingService.calculateWeightedScore(rubric);
    logger.info(`[API/Scorecard] Saving evaluation for interview ${interviewId}, weighted score: ${weightedScore}%`);

    const intSupabase = await createInterviewClient();
    const appSupabase = await createAppClient();

    // Fetch interview details
    const { data: intRecord } = await intSupabase
      .from("interviews")
      .select("id, application_id")
      .eq("id", interviewId)
      .maybeSingle();

    if (!intRecord) {
      return NextResponse.json({ error: "Interview record not found" }, { status: 404 });
    }

    // Get recruiter ID if available
    const { data: recruiter } = await supabase
      .schema("organization")
      .from("recruiters")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const recruiterId = recruiter?.id || user.id;

    // 1. Insert Scorecard
    const { data: scorecard, error: scorecardErr } = await intSupabase
      .from("scorecards")
      .insert({
        interview_id: interviewId,
        recruiter_id: recruiterId,
        technical_score: rubric.technicalScore,
        problem_solving_score: rubric.problemSolvingScore,
        communication_score: rubric.communicationScore,
        culture_fit_score: rubric.experienceScore,
        confidence_level: rubric.judgmentScore,
        strengths: [technicalNotes, problemSolvingNotes].filter(Boolean).join(" | "),
        weaknesses: [communicationNotes, experienceNotes, judgmentNotes].filter(Boolean).join(" | "),
        notes: overallNotes || "Recruiter Final Interview Scorecard Completed",
        recommendation,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (scorecardErr) {
      logger.warn(`[API/Scorecard] Scorecard insert notice: ${scorecardErr.message}`);
    }

    // 2. Update Interview record to completed
    await intSupabase
      .from("interviews")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", interviewId);

    // 3. Update Application: set interview_avg_score, interview_recommendation, and move to hiring_decision
    await appSupabase
      .from("applications")
      .update({
        interview_avg_score: weightedScore,
        interview_recommendation: recommendation,
        status: "hiring_decision",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intRecord.application_id);

    // Log history
    try {
      await appSupabase.from("application_status_history").insert({
        application_id: intRecord.application_id,
        from_status: "zoom_interview",
        to_status: "hiring_decision",
        notes: `Recruiter Final Interview completed with score ${weightedScore}% and recommendation: ${recommendation}`,
        changed_by: user.id,
      });
    } catch {
      // Safe fallback
    }

    return NextResponse.json({
      success: true,
      data: {
        scorecard: scorecard || { weightedScore, recommendation },
        weightedScore,
        recommendation,
        applicationId: intRecord.application_id,
        nextStage: "hiring_decision",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[API/Scorecard] Error", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
