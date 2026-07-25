import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { ATSEngine } from "@/services/ats/ats-engine";
import { logger } from "@smarthire/logger";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAppClient();

    // 1. Authenticate recruiter session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    logger.info(`[ATS Screening] Recruiter ${user.id} initiated screening for job ${jobId}`);

    // 2. Fetch applications in screening status
    const { data: apps, error: appsErr } = await supabase
      .from("applications")
      .select("id, candidate_id, resume_id")
      .eq("job_id", jobId)
      .eq("status", "screening")
      .is("deleted_at", null);

    if (appsErr) {
      logger.error("Failed to fetch applications for screening", appsErr);
      return NextResponse.json({ error: "Database query failed" }, { status: 500 });
    }

    if (!apps || apps.length === 0) {
      return NextResponse.json({ data: [], message: "No applications found in Profile Screening stage" });
    }

    const candidateIds = apps.map((a) => a.candidate_id);

    // 3. Fetch candidate profiles
    const { data: cands } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id, tags, summary, headline")
      .in("id", candidateIds);

    // 4. Fetch candidate resumes
    const { data: resumes } = await supabase
      .schema("candidate")
      .from("resumes")
      .select("candidate_id, parsed_text")
      .in("candidate_id", candidateIds);

    // 5. Fetch job details
    const { data: job, error: jobErr } = await supabase
      .schema("job")
      .from("jobs")
      .select("title, description, category")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      logger.error("Failed to fetch job details", jobErr);
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    const jobDescriptionText = `${job.title}\nCategory: ${job.category || ""}\n${job.description || ""}`;

    // 6. Run Extracted ATS Core Engine for each application
    let processedCount = 0;
    for (const app of apps) {
      const cand = cands?.find((c) => c.id === app.candidate_id);
      const res = resumes?.find((r) => r.candidate_id === app.candidate_id);

      const resumeContent =
        res?.parsed_text ||
        `${cand?.headline || ""} ${cand?.summary || ""} Skills: ${(cand?.tags || []).join(", ")}`.trim() ||
        "Applicant Profile Resume Data";

      const result = ATSEngine.evaluate(resumeContent, jobDescriptionText);

      // Score out of 10 for legacy score column, and percentage for screening_score
      const scoreOutOf10 = Math.round((result.atsScore / 10) * 10) / 10;

      await supabase
        .from("applications")
        .update({
          score: scoreOutOf10,
          screening_score: result.atsScore,
        })
        .eq("id", app.id);

      processedCount++;
    }

    logger.info(`[ATS Screening] Completed screening for job ${jobId}. Screened ${processedCount} candidates using ATS Core Engine.`);
    return NextResponse.json({ success: true, count: processedCount });
  } catch (err: unknown) {
    logger.error("API error in applications screen route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Screening execution failed", message }, { status: 500 });
  }
}
