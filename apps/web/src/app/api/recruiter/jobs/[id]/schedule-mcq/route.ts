import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createJobClient } from "@/utils/supabase/job";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { logger } from "@smarthire/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: jobId } = await context.params;
    const appClient = await createAppClient();
    const jobClient = await createJobClient();
    const assessmentClient = await createAssessmentClient();

    // 1. Authenticate recruiter session
    const {
      data: { user },
      error: authError,
    } = await appClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { scheduledTime, assessmentId, templateFileName, durationMinutes } = await request.json();
    if (!scheduledTime) {
      return NextResponse.json({ error: "scheduledTime is required" }, { status: 400 });
    }

    logger.info(`[MCQ Scheduler] Recruiter ${user.id} scheduling MCQ exam for job ${jobId} at ${scheduledTime} with PDF template: ${templateFileName || "default"}`);

    // 2. Fetch job posting details
    const { data: job, error: jobErr } = await jobClient
      .from("jobs")
      .select("title, company_id, mcq_assessment_id, description")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      logger.error("Failed to fetch job details for scheduling", jobErr);
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    let finalAssessmentId = assessmentId || job.mcq_assessment_id;
    const finalDuration = durationMinutes ? Number(durationMinutes) : 10;

    if (templateFileName || !finalAssessmentId) {
      const templateTitle = `${job.title} - MCQ Screening Assessment`;
      const templateDesc = `MCQ screening evaluation for ${job.title}`;

      const { data: newTpl } = await assessmentClient
        .from("assessments")
        .insert({
          company_id: job.company_id,
          title: templateTitle,
          description: templateDesc,
          duration_minutes: finalDuration,
          passing_percentage: 60,
          status: "published",
        })
        .select("id")
        .maybeSingle();

      if (newTpl) {
        finalAssessmentId = newTpl.id;

        await assessmentClient
          .from("questions")
          .insert([
            {
              assessment_id: newTpl.id,
              question_text: `What is the primary operational responsibility of a ${job.title}?`,
              question_type: "mcq",
              options: ["Executing core domain workflows & code", "Designing brand logo", "Handling finance audit", "Manual paper sorting"],
              correct_answer: "Executing core domain workflows & code",
              points: 5,
              difficulty: "easy",
              category: "Core Competencies",
            },
          ]);
      }
    }

    if (!finalAssessmentId) {
      return NextResponse.json({ error: "Could not auto-assign an MCQ assessment template" }, { status: 500 });
    }

    // 3. Update job with MCQ assessment template and scheduled start time
    const { error: updJobErr } = await jobClient
      .from("jobs")
      .update({
        mcq_assessment_id: finalAssessmentId,
        mcq_scheduled_start_at: scheduledTime,
      })
      .eq("id", jobId);

    if (updJobErr) {
      logger.error("Failed to update job scheduling details", updJobErr);
      return NextResponse.json({ error: "Failed to update job schedule" }, { status: 500 });
    }

    // 4. Fetch all active applications for this job posting
    const { data: apps, error: appsErr } = await appClient
      .from("applications")
      .select("id, candidate_id, status")
      .eq("job_id", jobId)
      .is("deleted_at", null);

    if (appsErr) {
      logger.error("Failed to fetch applications for scheduling assignments", appsErr);
      return NextResponse.json({ error: "Database error fetching applications" }, { status: 500 });
    }

    // 5. Upsert assignments in assessment.assignments schema for each candidate
    if (apps && apps.length > 0) {
      for (const app of apps) {
        const candidateProfileId = app.candidate_id;

        // Check if an assignment already exists
        const { data: existingAssignment } = await assessmentClient
          .from("assignments")
          .select("id")
          .eq("application_id", app.id)
          .eq("assessment_id", finalAssessmentId)
          .maybeSingle();

        if (existingAssignment) {
          await assessmentClient
            .from("assignments")
            .update({
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", existingAssignment.id);
        } else {
          await assessmentClient
            .from("assignments")
            .insert({
              assessment_id: finalAssessmentId,
              company_id: job.company_id,
              application_id: app.id,
              candidate_id: candidateProfileId,
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              attempt_limit: 1,
              attempts_count: 0,
              status: "assigned",
            });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    logger.error("API error in schedule MCQ route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Scheduling execution failed", message }, { status: 500 });
  }
}
