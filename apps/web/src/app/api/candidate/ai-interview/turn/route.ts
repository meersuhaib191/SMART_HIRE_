import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { createJobClient } from "@/utils/supabase/job";
import { LiveInterviewService } from "@/services/ai/live-interview-service";
import { logger } from "@smarthire/logger";

/**
 * POST /api/candidate/ai-interview/turn
 *
 * Processes candidate turn answer, persists turn data immediately,
 * and calls Gemini REST API ONCE to evaluate evidence and generate next question.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAppClient();
    const assessmentClient = await createAssessmentClient();
    const jobClient = await createJobClient();

    // 1. Authenticate candidate session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const {
      assignmentId,
      candidateAnswer,
      currentQuestion,
      questionNumber = 1,
      remainingSeconds = 3600,
      durationMinutes = 60,
    } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    // 2. Resolve assignment
    let assignment: any = null;
    const { data: directMatch } = await assessmentClient
      .from("assignments")
      .select("id, assessment_id, application_id, candidate_id, status")
      .eq("id", assignmentId)
      .maybeSingle();

    if (directMatch) {
      assignment = directMatch;
    } else {
      const { data: candidateProf } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (candidateProf?.id) {
        const { data: fallback } = await assessmentClient
          .from("assignments")
          .select("id, assessment_id, application_id, candidate_id, status")
          .eq("candidate_id", candidateProf.id)
          .in("status", ["assigned", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        assignment = fallback;
      }
    }

    if (!assignment) {
      return NextResponse.json({ error: "AI Interview Assignment not found" }, { status: 404 });
    }

    const resolvedAssignmentId = assignment.id;

    // 3. Fetch attempt (with fallback auto-creation)
    let { data: attempt } = await assessmentClient
      .from("attempts")
      .select("*")
      .eq("assignment_id", resolvedAssignmentId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!attempt) {
      const nowIso = new Date().toISOString();
      const { data: newAttempt } = await assessmentClient
        .from("attempts")
        .insert({
          assignment_id: resolvedAssignmentId,
          assessment_id: assignment.assessment_id,
          candidate_id: assignment.candidate_id,
          started_at: nowIso,
          status: "in_progress",
          score: 0,
          answers: { turns: [] },
        })
        .select("*")
        .maybeSingle();

      attempt = newAttempt || {
        id: `att-${resolvedAssignmentId}`,
        assignment_id: resolvedAssignmentId,
        answers: { turns: [] },
      };
    }

    const answersObj = attempt.answers || {};
    const turns: any[] = Array.isArray(answersObj.turns) ? answersObj.turns : [];

    // Find and update current question turn with candidate answer
    const nowIso = new Date().toISOString();
    const currentTurnIdx = turns.findIndex((t) => t.questionNumber === questionNumber || t.questionText === currentQuestion);

    if (currentTurnIdx !== -1) {
      turns[currentTurnIdx].candidateAnswer = candidateAnswer || "";
      turns[currentTurnIdx].answeredAt = nowIso;
    } else {
      turns.push({
        questionNumber,
        questionText: currentQuestion,
        candidateAnswer: candidateAnswer || "",
        answeredAt: nowIso,
      });
    }

    // 4. Fetch context for turn processing
    let jobTitle = answersObj.jobTitle || "Technical Position";
    let jobDescription = answersObj.jobDescription || "Technical role evaluation";

    if (assignment.application_id && (!answersObj.jobTitle || !answersObj.jobDescription)) {
      const { data: app } = await supabase
        .from("applications")
        .select("job_id")
        .eq("id", assignment.application_id)
        .maybeSingle();

      if (app?.job_id) {
        const { data: job } = await jobClient
          .from("jobs")
          .select("title, description")
          .eq("id", app.job_id)
          .maybeSingle();

        if (job) {
          jobTitle = job.title;
          jobDescription = job.description || jobDescription;
        }
      }
    }

    // 5. Calculate asked questions and consecutive no-responses
    const askedQuestionTexts = turns.map((t) => t.questionText).filter(Boolean);
    let consecutiveNoResponses = 0;
    for (let i = turns.length - 1; i >= 0; i--) {
      const ans = turns[i].candidateAnswer;
      const isNoResp = !ans || ans.trim().length === 0 || ans.toLowerCase().includes("no verbal response");
      if (isNoResp) consecutiveNoResponses++;
      else break;
    }

    const remainingMinutes = Math.max(0, Math.ceil(remainingSeconds / 60));

    const turnResult = await LiveInterviewService.processInterviewTurn({
      jobTitle,
      jobDescription,
      candidateName: answersObj.candidateName || "Candidate",
      durationMinutes,
      remainingMinutes,
      currentQuestion,
      candidateAnswer: candidateAnswer || "",
      questionNumber,
      askedQuestionTexts,
      consecutiveNoResponses,
    });

    // Record turn answer evidence & quality
    if (currentTurnIdx !== -1) {
      turns[currentTurnIdx].evidence = turnResult.answerEvidence;
      turns[currentTurnIdx].answerQuality = turnResult.answerQuality;
    }

    // Handle next action
    let nextQuestionText = "";
    let nextQuestionNumber = questionNumber;

    if (turnResult.nextAction === "question" && turnResult.nextQuestion?.text) {
      nextQuestionNumber = questionNumber + 1;
      nextQuestionText = turnResult.nextQuestion.text;

      turns.push({
        questionNumber: nextQuestionNumber,
        questionText: nextQuestionText,
        competency: turnResult.nextQuestion.competency || "general",
        isFollowUp: Boolean(turnResult.nextQuestion.isFollowUp),
        askedAt: nowIso,
      });
    }

    // 6. Progressive persistence of updated turns
    await assessmentClient
      .from("attempts")
      .update({
        answers: {
          ...answersObj,
          turns,
          jobTitle,
          jobDescription,
        },
      })
      .eq("id", attempt.id);

    logger.info(`[AI Interview Turn] Turn ${questionNumber} completed (Assignment: ${resolvedAssignmentId}, Next Action: ${turnResult.nextAction})`);

    return NextResponse.json({
      success: true,
      nextAction: turnResult.nextAction,
      nextQuestion: nextQuestionText,
      questionNumber: nextQuestionNumber,
      answerEvidence: turnResult.answerEvidence,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error in ai-interview turn route", err);
    return NextResponse.json({ error: "Failed to process interview turn", message }, { status: 500 });
  }
}
