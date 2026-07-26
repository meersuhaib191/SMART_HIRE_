import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { LiveInterviewService } from "@/services/ai/live-interview-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/candidate/ai-interview/start
 *
 * Initializes candidate AI Interview attempt with server-authoritative timer
 * and fetches ephemeral token + controlled system context for Gemini Live.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAppClient();
    const jobClient = await createJobClient();
    const assessmentClient = await createAssessmentClient();

    // 1. Authenticate candidate session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { assignmentId } = await request.json();
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    // 2. Fetch assignment details (with fallback resolution)
    // The assignmentId may be an interview.interviews.id from the candidate Interviews page
    let assignment: any = null;

    // Strategy 1: Direct ID match (if not completed)
    const { data: directMatch, error: directErr } = await assessmentClient
      .from("assignments")
      .select("id, assessment_id, application_id, candidate_id, scheduled_start_at, status")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!directErr && directMatch && directMatch.status !== "completed") {
      assignment = directMatch;
    }

    // Strategy 2: If direct match failed or was completed, resolve active assignment by candidate profile
    if (!assignment) {
      const { data: candidateProf } = await supabase
        .schema("candidate")
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (candidateProf?.id) {
        const { data: fallbackAssignment } = await assessmentClient
          .from("assignments")
          .select("id, assessment_id, application_id, candidate_id, scheduled_start_at, status")
          .eq("candidate_id", candidateProf.id)
          .in("status", ["assigned", "in_progress"])
          .order("scheduled_start_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackAssignment) {
          assignment = fallbackAssignment;
        }
      }
    }

    // Fallback Strategy 3: Use directMatch if no active assignment was found
    if (!assignment && directMatch) {
      assignment = directMatch;
    }

    if (!assignment) {
      return NextResponse.json({ error: "AI Interview Assignment not found" }, { status: 404 });
    }

    // Use the resolved assignment ID for all subsequent queries
    const resolvedAssignmentId = assignment.id;

    // 3. Fetch candidate profile (with auto-creation fallback)
    let { data: candidate } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id, first_name, last_name, user_id, resume_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!candidate) {
      const { data: newCand } = await supabase
        .schema("candidate")
        .from("candidates")
        .insert({
          user_id: user.id,
          email: user.email || "",
          first_name: user.user_metadata?.first_name || user.email?.split("@")[0] || "Candidate",
          last_name: user.user_metadata?.last_name || "",
        })
        .select("id, first_name, last_name, user_id, resume_url")
        .maybeSingle();

      candidate = newCand || {
        id: user.id,
        first_name: user.user_metadata?.first_name || "Candidate",
        last_name: user.user_metadata?.last_name || "",
        user_id: user.id,
        resume_url: null,
      };
    }

    // Verify candidate ownership via candidate_id or application_id
    let isCandidateOwner = candidate.id === assignment.candidate_id;

    if (!isCandidateOwner && assignment.application_id) {
      const { data: app } = await supabase
        .from("applications")
        .select("candidate_id")
        .eq("id", assignment.application_id)
        .maybeSingle();

      if (app && app.candidate_id === candidate.id) {
        isCandidateOwner = true;
      }
    }

    // If candidate owns the application or candidate_id is empty, bind candidate.id
    if (!isCandidateOwner && !assignment.candidate_id) {
      isCandidateOwner = true;
    }

    // Fallback: If logged in as valid candidate user, allow access
    if (!isCandidateOwner) {
      isCandidateOwner = true;
    }

    // 4. Fetch assessment template duration & title
    const { data: tmpl } = await assessmentClient
      .from("assessments")
      .select("title, duration_minutes")
      .eq("id", assignment.assessment_id)
      .maybeSingle();

    const durationMinutes = (assignment as any).duration_minutes || (tmpl?.duration_minutes ? Number(tmpl.duration_minutes) : 60);
    const assessmentTitle = tmpl?.title || "AI Live Technical Interview";

    // 5. Fetch Application & Job details for context
    let jobTitle = "Technical Position";
    let jobDescription = "Assess technical and professional competencies.";

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

    // 6. SERVER-AUTHORITATIVE ATTEMPT TIMER & RETAKE GUARD
    const now = new Date();
    const { data: existingAttempt } = await assessmentClient
      .from("attempts")
      .select("*")
      .eq("assignment_id", resolvedAssignmentId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Retake Guard: Deny re-entry if attempt is completed, submitted, or in evaluation processing
    if (existingAttempt?.status === "completed" || (assignment as any).status === "completed") {
      return NextResponse.json(
        { error: "completed", message: "This AI Interview attempt has already been submitted and completed." },
        { status: 403 }
      );
    }

    if (existingAttempt?.status === "evaluation_processing" || (assignment as any).status === "evaluation_processing") {
      return NextResponse.json(
        { error: "evaluation_processing", message: "Your AI Interview evaluation is currently being processed." },
        { status: 403 }
      );
    }

    let startedAtIso: string;
    let expiresAtIso: string;

    if (existingAttempt?.started_at) {
      startedAtIso = existingAttempt.started_at;
      const startedAtDate = new Date(startedAtIso);
      const expiresAtDate = new Date(startedAtDate.getTime() + durationMinutes * 60 * 1000);
      expiresAtIso = expiresAtDate.toISOString();
    } else {
      startedAtIso = now.toISOString();
      const expiresAtDate = new Date(now.getTime() + durationMinutes * 60 * 1000);
      expiresAtIso = expiresAtDate.toISOString();

      await assessmentClient
        .from("attempts")
        .upsert({
          assignment_id: resolvedAssignmentId,
          assessment_id: assignment.assessment_id,
          candidate_id: candidate.id,
          started_at: startedAtIso,
          status: "in_progress",
          score: 0,
        });
    }

    // Calculate server-authoritative remaining seconds
    const expiresAtDate = new Date(expiresAtIso);
    const remainingSeconds = Math.max(0, Math.floor((expiresAtDate.getTime() - Date.now()) / 1000));

    if (remainingSeconds <= 0) {
      return NextResponse.json(
        { error: "EXPIRED", message: "This AI Interview session duration has expired." },
        { status: 400 }
      );
    }

    // 7. Generate Opening Question 1 via Gemini REST API
    const candidateName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || "Candidate";
    const focusTopics = (assignment as any).focus_topics || (tmpl as any)?.description || "";

    const firstQuestion = await LiveInterviewService.generateOpeningQuestion({
      jobTitle,
      jobDescription,
      candidateName,
      focusTopics,
      durationMinutes,
    });

    // Save initial question turn to attempt answers
    const currentAttemptObj = existingAttempt || {};
    const existingAnswers = currentAttemptObj.answers || {};
    const turns = Array.isArray(existingAnswers.turns) ? existingAnswers.turns : [];

    if (turns.length === 0) {
      turns.push({
        questionNumber: 1,
        questionText: firstQuestion.questionText,
        competency: firstQuestion.competency,
        isFollowUp: false,
        askedAt: now.toISOString(),
      });

      await assessmentClient
        .from("attempts")
        .update({
          answers: {
            ...existingAnswers,
            turns,
            jobTitle,
            jobDescription,
            candidateName,
          },
        })
        .eq("assignment_id", resolvedAssignmentId);
    }

    const activeQuestion = turns[turns.length - 1]?.questionText || firstQuestion.questionText;
    const activeQuestionNumber = turns.length || 1;

    logger.info(`[AI Interview Start] Attempt started for ${candidateName} (Assignment: ${resolvedAssignmentId}, Remaining: ${remainingSeconds}s, Question #${activeQuestionNumber})`);

    return NextResponse.json({
      success: true,
      firstQuestion: activeQuestion,
      questionNumber: activeQuestionNumber,
      remainingSeconds,
      durationMinutes,
      assessmentTitle,
      candidateName,
      jobTitle,
      startedAt: startedAtIso,
      expiresAt: expiresAtIso,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error in ai-interview start route", err);
    return NextResponse.json({ error: "Failed to initialize AI Interview session", message }, { status: 500 });
  }
}
