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
    const { topN }: { topN: number } = body;

    if (!topN || topN <= 0) {
      return NextResponse.json({ error: "Invalid Top N parameter. Must be > 0" }, { status: 400 });
    }

    // 2. Fetch Applications for this job
    const { data: apps, error: appErr } = await appClient
      .from("applications")
      .select("id, candidate_id, status, ai_interview_score, interview_avg_score, created_at")
      .eq("job_id", jobId)
      .is("deleted_at", null);

    if (appErr || !apps || apps.length === 0) {
      return NextResponse.json({ error: "No applications found for job" }, { status: 404 });
    }

    // Filter out applications that are already advanced past AI interview stage
    const eligibleApps = apps.filter((a) =>
      ["interview", "ai_interview"].includes(a.status)
    );

    if (eligibleApps.length === 0) {
      return NextResponse.json({
        error: "No un-advanced completed candidates available in AI Interview stage.",
      }, { status: 400 });
    }

    const appIds = eligibleApps.map((a) => a.id);

    // 3. Fetch Assignments and Completed Attempts
    const { data: assignments } = await assessmentClient
      .from("assignments")
      .select("id, application_id, status")
      .in("application_id", appIds);

    const assignList = assignments || [];
    const assignIds = assignList.map((a) => a.id);
    const assignMap = new Map(assignList.map((a) => [a.application_id, a]));

    let attemptMap = new Map<string, any>();
    if (assignIds.length > 0) {
      const { data: attempts } = await assessmentClient
        .from("attempts")
        .select("*")
        .in("assignment_id", assignIds)
        .eq("status", "completed");

      if (attempts && attempts.length > 0) {
        attempts.forEach((att) => {
          attemptMap.set(att.assignment_id, att);
        });
      }
    }

    // 4. Map candidates with authoritative scores and evaluation dimensions
    interface RankedCandidate {
      appId: string;
      candidateId: string;
      overallScore: number;
      technicalScore: number;
      problemSolvingScore: number;
      completedAt: string;
    }

    const completedRankableList: RankedCandidate[] = [];

    eligibleApps.forEach((app) => {
      const assign = assignMap.get(app.id);
      const att = assign ? attemptMap.get(assign.id) : null;

      if (att && att.status === "completed") {
        const evalData = att.answers?.evaluation || {};
        const score = typeof att.score === "number" && att.score > 0
          ? Math.min(100, Math.max(0, Math.round(att.score)))
          : (typeof app.ai_interview_score === "number" ? Math.min(100, Math.round(app.ai_interview_score)) : 0);

        if (score > 0) {
          completedRankableList.push({
            appId: app.id,
            candidateId: app.candidate_id,
            overallScore: score,
            technicalScore: evalData.technicalCompetence?.score || 0,
            problemSolvingScore: evalData.problemSolving?.score || 0,
            completedAt: att.completed_at || att.created_at || app.created_at,
          });
        }
      }
    });

    if (completedRankableList.length === 0) {
      return NextResponse.json({
        error: "No completed and evaluated candidates found for advancement.",
      }, { status: 400 });
    }

    // 5. Apply Deterministic Ranking:
    // 1. overallScore DESC
    // 2. technicalScore DESC
    // 3. problemSolvingScore DESC
    // 4. completedAt ASC
    completedRankableList.sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      if (b.technicalScore !== a.technicalScore) return b.technicalScore - a.technicalScore;
      if (b.problemSolvingScore !== a.problemSolvingScore) return b.problemSolvingScore - a.problemSolvingScore;
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    });

    // Constrain N to available eligible candidates count
    const safeN = Math.min(topN, completedRankableList.length);
    const topCandidatesToAdvance = completedRankableList.slice(0, safeN);

    // 6. Execute Stage Transitions Server-Side
    const advancedList: any[] = [];
    for (const candItem of topCandidatesToAdvance) {
      await stageTransitionService.transitionStage({
        applicationId: candItem.appId,
        fromStage: "interview",
        toStage: "zoom_interview",
        reason: `Top ${safeN} AI Interview Advancement (Ranked Score: ${candItem.overallScore}%)`,
        notifyCandidate: true,
      });

      advancedList.push({
        applicationId: candItem.appId,
        candidateId: candItem.candidateId,
        score: candItem.overallScore,
      });
    }

    logger.info(`[Advance AI Interview] Successfully advanced top ${safeN} candidates for Job ${jobId}`);

    return NextResponse.json({
      success: true,
      count: safeN,
      advancedCandidates: advancedList,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error advancing AI interview candidates", err);
    return NextResponse.json({ error: "Failed to advance candidates", message }, { status: 500 });
  }
}
