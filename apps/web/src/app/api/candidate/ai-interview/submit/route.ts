import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { LiveInterviewService, InterviewTranscriptTurn } from "@/services/ai/live-interview-service";
import { logger } from "@smarthire/logger";

/**
 * POST /api/candidate/ai-interview/submit
 *
 * Receives completed conversational transcript, runs evidence-based evaluation via Gemini,
 * and persists authoritative assessment results to Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAppClient();
    const jobClient = await createJobClient();
    const assessmentClient = await createAssessmentClient();

    // 1. Authenticate candidate
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
      transcript,
      timeSpentSeconds,
    }: {
      assignmentId: string;
      transcript: InterviewTranscriptTurn[];
      timeSpentSeconds: number;
    } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    // 2. Fetch assignment
    const { data: assignment, error: assignErr } = await assessmentClient
      .from("assignments")
      .select("id, assessment_id, application_id, candidate_id")
      .eq("id", assignmentId)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // 3. Fetch candidate profile
    const { data: candidate } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!candidate || candidate.id !== assignment.candidate_id) {
      return NextResponse.json({ error: "Forbidden: Candidate profile mismatch" }, { status: 403 });
    }

    // 4. Fetch Job details
    let jobTitle = "Technical Position";
    let jobDescription = "Technical skills and professional judgment evaluation.";

    if (assignment.application_id) {
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

    // 5. Fetch template duration
    const { data: tmpl } = await assessmentClient
      .from("assessments")
      .select("duration_minutes")
      .eq("id", assignment.assessment_id)
      .maybeSingle();

    const durationMinutes = tmpl?.duration_minutes ? Number(tmpl.duration_minutes) : 60;
    const safeTranscript = Array.isArray(transcript) ? transcript : [];

    // 6. Handle Empty / Insufficient Transcript
    if (safeTranscript.length === 0) {
      const completedAt = new Date().toISOString();
      const emptyAnswers = {
        transcript: [],
        evaluation: {
          overallScore: 0,
          passed: false,
          summary: "No interview transcript recorded.",
          strengths: [],
          developmentAreas: ["Candidate did not record any speech turns."],
        },
        timeSpentSeconds: timeSpentSeconds || 0,
        completedAt,
        status: "completed",
      };

      await assessmentClient
        .from("attempts")
        .update({
          score: 0,
          passed: false,
          status: "completed",
          completed_at: completedAt,
          time_spent_seconds: timeSpentSeconds || 0,
          answers: emptyAnswers,
        })
        .eq("assignment_id", assignmentId);

      await assessmentClient
        .from("assignments")
        .update({ status: "completed" })
        .eq("id", assignmentId);

      return NextResponse.json({
        success: true,
        overallScore: 0,
        passed: false,
        evaluation: emptyAnswers.evaluation,
      });
    }

    // 7. Execute Evidence-Based Evaluation via Gemini Service
    logger.info(`[AI Interview Submit] Evaluating transcript (${safeTranscript.length} turns) for ${candidate.first_name} ${candidate.last_name}`);

    const evaluation = await LiveInterviewService.evaluateTranscript({
      jobTitle,
      jobDescription,
      transcript: safeTranscript,
      durationMinutes,
      timeSpentSeconds: timeSpentSeconds || 60,
    });

    const completedAt = new Date().toISOString();
    const finalScore = evaluation.overallScore;
    const finalPassed = evaluation.passed;
    const finalScore10 = Math.round((finalScore / 10) * 10) / 10;

    const persistedAnswers = {
      transcript: safeTranscript,
      evaluation,
      timeSpentSeconds: timeSpentSeconds || 0,
      completedAt,
      status: "completed",
    };

    // 8. Update Attempt
    await assessmentClient
      .from("attempts")
      .update({
        score: finalScore,
        passed: finalPassed,
        status: "completed",
        completed_at: completedAt,
        time_spent_seconds: timeSpentSeconds || 0,
        answers: persistedAnswers,
      })
      .eq("assignment_id", assignmentId);

    // 9. Update Assignment
    await assessmentClient
      .from("assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);

    // 10. Update Application record
    if (assignment.application_id) {
      await supabase
        .from("applications")
        .update({
          ai_interview_score: finalScore10,
          ai_interview_passed: finalPassed,
          updated_at: completedAt,
        })
        .eq("id", assignment.application_id);
    }

    logger.info(`[AI Interview Submit] Finalized attempt for Assignment ${assignmentId}. Score: ${finalScore}%`);

    return NextResponse.json({
      success: true,
      overallScore: finalScore,
      passed: finalPassed,
      evaluation,
      timeSpentSeconds: timeSpentSeconds || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error in ai-interview submit route", err);
    return NextResponse.json({ error: "Failed to process interview submission", message }, { status: 500 });
  }
}
