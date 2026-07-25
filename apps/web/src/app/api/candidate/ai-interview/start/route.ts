import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { LiveInterviewService } from "@/services/ai/live-interview-service";
import { logger } from "@smarthire/logger";

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

    // 2. Fetch assignment details
    const { data: assignment, error: assignErr } = await assessmentClient
      .from("assignments")
      .select("id, assessment_id, application_id, candidate_id, scheduled_start_at, status")
      .eq("id", assignmentId)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json({ error: "AI Interview Assignment not found" }, { status: 404 });
    }

    // 3. Fetch candidate profile
    const { data: candidate } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id, first_name, last_name, user_id, resume_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!candidate || candidate.id !== assignment.candidate_id) {
      return NextResponse.json({ error: "Forbidden: Candidate profile mismatch" }, { status: 403 });
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

    // 6. SERVER-AUTHORITATIVE ATTEMPT TIMER
    const now = new Date();
    const { data: existingAttempt } = await assessmentClient
      .from("attempts")
      .select("*")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

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
          assignment_id: assignmentId,
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

    // 7. Obtain Ephemeral Token from Gemini Service
    const ephemeralToken = await LiveInterviewService.createEphemeralToken(durationMinutes);

    // 8. Build Controlled System Prompt for Gemini Live
    const candidateName = `${candidate.first_name} ${candidate.last_name}`.trim();
    const systemPrompt = LiveInterviewService.buildInterviewSystemPrompt({
      jobTitle,
      jobDescription,
      candidateName,
      durationMinutes,
      remainingMinutes: Math.ceil(remainingSeconds / 60),
    });

    logger.info(`[AI Interview Start] Attempt started for ${candidateName} (Assignment: ${assignmentId}, Remaining: ${remainingSeconds}s)`);

    return NextResponse.json({
      success: true,
      ephemeralToken,
      remainingSeconds,
      durationMinutes,
      assessmentTitle,
      candidateName,
      jobTitle,
      systemPrompt,
      startedAt: startedAtIso,
      expiresAt: expiresAtIso,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error in ai-interview start route", err);
    return NextResponse.json({ error: "Failed to initialize AI Interview session", message }, { status: 500 });
  }
}
