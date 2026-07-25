import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { logger } from "@smarthire/logger";

/**
 * GET /api/assessments/[submissionId]/transcript
 *
 * Returns the complete coding assessment transcript for a given attempt.
 * Authorization: candidate can only access own transcript; recruiter can access
 * transcripts for jobs in their organization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const supabase = await createAppClient();
    const { submissionId } = await params;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the attempt
    const { data: attempt, error: attemptErr } = await supabase
      .schema("assessment")
      .from("attempts")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (attemptErr || !attempt) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Authorization: check if this user owns this attempt
    // First check if user is the candidate
    const { data: candProfile } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let authorized = candProfile?.id === attempt.candidate_id;

    // If not the candidate, check if user is a recruiter for the related job
    if (!authorized) {
      const { data: assignment } = await supabase
        .schema("assessment")
        .from("assignments")
        .select("application_id, company_id")
        .eq("id", attempt.assignment_id)
        .maybeSingle();

      if (assignment) {
        const { data: recruiterProfile } = await supabase
          .schema("recruiter")
          .from("profiles")
          .select("id, company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (recruiterProfile?.company_id === assignment.company_id) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build transcript from persisted answers
    const ans = attempt.answers || {};
    const questionResults = Array.isArray(ans.questionResults) ? ans.questionResults : [];
    const assessmentSummary = ans.assessmentSummary || {};

    // Fetch candidate info
    const { data: candidate } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("first_name, last_name, email")
      .eq("id", attempt.candidate_id)
      .maybeSingle();

    // Fetch job info via assignment -> application
    let jobTitle = "Coding Assessment";
    const { data: assignmentInfo } = await supabase
      .schema("assessment")
      .from("assignments")
      .select("application_id")
      .eq("id", attempt.assignment_id)
      .maybeSingle();

    if (assignmentInfo?.application_id) {
      const { data: application } = await supabase
        .from("applications")
        .select("job_id")
        .eq("id", assignmentInfo.application_id)
        .maybeSingle();

      if (application?.job_id) {
        const { data: job } = await supabase
          .schema("job")
          .from("jobs")
          .select("title")
          .eq("id", application.job_id)
          .maybeSingle();

        if (job?.title) jobTitle = job.title;
      }
    }

    // Strip hidden test I/O from candidate-facing transcript
    const isCandidateViewing = candProfile?.id === attempt.candidate_id;
    const safeQuestionResults = questionResults.map((qr: any) => {
      const safeTestResults = isCandidateViewing
        ? (qr.testResults || []).map((tr: any) => ({
            ...tr,
            input: tr.hidden ? "[HIDDEN]" : tr.input,
            expected: tr.hidden ? "[HIDDEN]" : tr.expected,
            actual: tr.hidden ? (tr.passed ? "[PASSED]" : "[FAILED]") : tr.actual,
          }))
        : qr.testResults || [];

      return {
        ...qr,
        testResults: safeTestResults,
        // Never expose reference solutions
        questionSnapshot: {
          ...qr.questionSnapshot,
          referenceSolution: undefined,
        },
      };
    });

    return NextResponse.json({
      transcript: {
        candidate: candidate ? {
          name: `${candidate.first_name} ${candidate.last_name}`,
          email: candidate.email,
        } : null,
        job: jobTitle,
        assessment: {
          submissionId: attempt.id,
          startedAt: attempt.started_at,
          completedAt: attempt.completed_at,
          overallScore: attempt.score,
          passed: attempt.passed,
          timeSpentSeconds: attempt.time_spent_seconds,
        },
        summary: assessmentSummary,
        questionResults: safeQuestionResults,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error generating transcript", err);
    return NextResponse.json({ error: "Failed to generate transcript", message }, { status: 500 });
  }
}
