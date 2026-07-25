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

    const { scheduledTime, assessmentId, templateFileName, durationMinutes, jsonQuestions } = await request.json();
    if (!scheduledTime) {
      return NextResponse.json({ error: "scheduledTime is required" }, { status: 400 });
    }

    // Pre-upload validation for MCQ JSON questions
    if (Array.isArray(jsonQuestions) && jsonQuestions.length > 0) {
      for (let i = 0; i < jsonQuestions.length; i++) {
        const q = jsonQuestions[i];
        const num = i + 1;
        const text = (q.questionText || q.question || q.title || "").toString().trim();
        if (!text) {
          return NextResponse.json({ error: `Question ${num} does not contain valid question text.` }, { status: 400 });
        }
        const opts = q.options;
        if (!Array.isArray(opts) || opts.length < 2) {
          return NextResponse.json({ error: `Question ${num} has fewer than two options.` }, { status: 400 });
        }
        const correct = q.correctAnswer ?? q.correct_answer ?? q.answer;
        if (correct === undefined || correct === null || correct === "") {
          return NextResponse.json({ error: `Question ${num} does not contain a correct answer.` }, { status: 400 });
        }
      }
    }

    logger.info(`[MCQ Scheduler] Recruiter ${user.id} scheduling MCQ exam for job ${jobId} at ${scheduledTime} with ${Array.isArray(jsonQuestions) ? jsonQuestions.length : 0} JSON questions`);

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

    let finalAssessmentId = assessmentId;
    const finalDuration = durationMinutes ? Number(durationMinutes) : (Array.isArray(jsonQuestions) && jsonQuestions.length > 0 ? Math.max(10, jsonQuestions.length) : 10);

    // If custom JSON questions uploaded or no dedicated assessment, create a fresh dedicated template for this job
    if (!finalAssessmentId || (Array.isArray(jsonQuestions) && jsonQuestions.length > 0)) {
      const templateTitle = `${job.title} - MCQ Screening Assessment`;
      const templateDesc = `MCQ screening evaluation for ${job.title}`;

      const { data: newTpl, error: createTplErr } = await assessmentClient
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
      } else if (job.mcq_assessment_id) {
        finalAssessmentId = job.mcq_assessment_id;
      } else {
        logger.error("Failed to create assessment template", createTplErr);
      }
    } else {
      // Update duration if specified
      await assessmentClient
        .from("assessments")
        .update({ duration_minutes: finalDuration })
        .eq("id", finalAssessmentId);
    }

    if (!finalAssessmentId) {
      return NextResponse.json({ error: "Could not auto-assign an MCQ assessment template" }, { status: 500 });
    }

    // Insert questions if JSON questions array was uploaded
    if (Array.isArray(jsonQuestions) && jsonQuestions.length > 0) {
      // Clean up previous questions for this template
      await assessmentClient
        .from("questions")
        .delete()
        .eq("assessment_id", finalAssessmentId);

      const rowsToInsert = jsonQuestions.map((q: any, idx: number) => {
        const text = (q.questionText || q.question || q.title || `Question ${idx + 1}`).toString().trim();
        let opts = q.options || ["Option A", "Option B", "Option C", "Option D"];
        let rawCorrect = q.correctAnswer ?? q.correct_answer ?? q.answer ?? "";

        // Normalize options array
        if (Array.isArray(opts)) {
          opts = opts.map((opt: any) => (typeof opt === "object" && opt !== null ? opt.text || opt.option || String(opt) : String(opt)));
        }

        let correctText = String(rawCorrect).trim();
        // If correct answer is a 0-based index or letter "A", "B", "C", "D"
        if (typeof rawCorrect === "number" && opts[rawCorrect]) {
          correctText = opts[rawCorrect];
        } else if (typeof rawCorrect === "string" && ["a", "b", "c", "d"].includes(rawCorrect.toLowerCase().trim())) {
          const letterIdx = ["a", "b", "c", "d"].indexOf(rawCorrect.toLowerCase().trim());
          if (opts[letterIdx]) correctText = opts[letterIdx];
        }

        // If correctText still doesn't match an option, check for exact case-insensitive match in options
        const matchOpt = opts.find((o: string) => o.toLowerCase().trim() === correctText.toLowerCase());
        if (matchOpt) correctText = matchOpt;

        const validCategories = ["programming", "aptitude", "custom"];
        const rawCat = (q.category || "").toString().toLowerCase().trim();
        const finalCategory = validCategories.includes(rawCat) ? rawCat : "programming";

        return {
          assessment_id: finalAssessmentId,
          question_text: text,
          question_type: "mcq",
          options: opts,
          correct_answer: correctText || (opts[0] ? opts[0] : "Option A"),
          points: q.points ? Number(q.points) : 1,
          difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty).toLowerCase()) ? String(q.difficulty).toLowerCase() : "medium",
          category: finalCategory,
        };
      });

      const { error: insErr } = await assessmentClient
        .from("questions")
        .insert(rowsToInsert);

      if (insErr) {
        logger.error("Failed to insert uploaded JSON questions", insErr);
        return NextResponse.json({ error: `Database error storing questions: ${insErr.message}` }, { status: 500 });
      }

      logger.info(`[MCQ Scheduler] Successfully persisted ${rowsToInsert.length} questions for assessment ${finalAssessmentId}`);
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
              status: "assigned",
              attempts_count: 0,
              scheduled_start_at: scheduledTime,
              expires_at: new Date(new Date(scheduledTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", existingAssignment.id);

          // Clear previous attempt for clean re-appearance
          await assessmentClient
            .from("attempts")
            .delete()
            .eq("assignment_id", existingAssignment.id);

          // Reset application stage score
          await appClient
            .from("applications")
            .update({ mcq_score: null, mcq_passed: null })
            .eq("id", app.id);
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
