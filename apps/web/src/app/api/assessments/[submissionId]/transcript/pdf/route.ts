import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { logger } from "@smarthire/logger";

/**
 * GET /api/assessments/[submissionId]/transcript/pdf
 *
 * Generates and returns a professional PDF coding assessment transcript.
 * Uses server-side HTML generation converted to a downloadable format.
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

    // Fetch attempt
    const { data: attempt } = await supabase
      .schema("assessment")
      .from("attempts")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (!attempt) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Authorization
    const { data: candProfile } = await supabase
      .schema("candidate")
      .from("candidates")
      .select("id, first_name, last_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    let authorized = candProfile?.id === attempt.candidate_id;
    let candidateName = candProfile ? `${candProfile.first_name} ${candProfile.last_name}` : "Candidate";
    let candidateEmail = candProfile?.email || "";

    if (!authorized) {
      const { data: assignment } = await supabase
        .schema("assessment")
        .from("assignments")
        .select("company_id")
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
          // Fetch actual candidate info for recruiter
          const { data: candInfo } = await supabase
            .schema("candidate")
            .from("candidates")
            .select("first_name, last_name, email")
            .eq("id", attempt.candidate_id)
            .maybeSingle();
          if (candInfo) {
            candidateName = `${candInfo.first_name} ${candInfo.last_name}`;
            candidateEmail = candInfo.email;
          }
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build transcript data
    const ans = attempt.answers || {};
    const questionResults = Array.isArray(ans.questionResults) ? ans.questionResults : [];
    const summary = ans.assessmentSummary || {};

    // Fetch job title
    let jobTitle = "Coding Assessment";
    const { data: assignmentInfo } = await supabase
      .schema("assessment")
      .from("assignments")
      .select("application_id")
      .eq("id", attempt.assignment_id)
      .maybeSingle();

    if (assignmentInfo?.application_id) {
      const { data: app } = await supabase
        .from("applications")
        .select("job_id")
        .eq("id", assignmentInfo.application_id)
        .maybeSingle();
      if (app?.job_id) {
        const { data: job } = await supabase
          .schema("job").from("jobs").select("title").eq("id", app.job_id).maybeSingle();
        if (job?.title) jobTitle = job.title;
      }
    }

    const timeUsed = summary.timeUsedSeconds
      ? `${Math.floor(summary.timeUsedSeconds / 60)}m ${summary.timeUsedSeconds % 60}s`
      : "—";

    // Generate HTML for PDF
    const questionsHtml = questionResults.map((qr: any, idx: number) => {
      const isAttempted = qr.status === "completed";

      const metricsHtml = isAttempted ? `
        <table style="width:100%;border-collapse:collapse;margin:8px 0;">
          <tr>
            <td style="padding:6px 12px;background:#f0fdf4;border:1px solid #d1fae5;font-weight:bold;">Functional Correctness</td>
            <td style="padding:6px 12px;border:1px solid #e5e7eb;">${qr.functionalPct}% (${qr.passedTests}/${qr.totalTests} tests)</td>
          </tr>
          ${qr.efficiency?.score != null ? `<tr><td style="padding:6px 12px;background:#fffbeb;border:1px solid #fde68a;font-weight:bold;">Efficiency</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${qr.efficiency.score}%</td></tr>` : ""}
          ${qr.codeQuality?.score != null ? `<tr><td style="padding:6px 12px;background:#eff6ff;border:1px solid #bfdbfe;font-weight:bold;">Code Quality</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${qr.codeQuality.score}%</td></tr>` : ""}
          ${qr.robustness?.score != null ? `<tr><td style="padding:6px 12px;background:#f5f3ff;border:1px solid #c4b5fd;font-weight:bold;">Robustness</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${qr.robustness.score}%</td></tr>` : ""}
          ${qr.readability?.score != null ? `<tr><td style="padding:6px 12px;background:#faf5ff;border:1px solid #d8b4fe;font-weight:bold;">Readability</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${qr.readability.score}%</td></tr>` : ""}
          ${qr.complexity ? `<tr><td style="padding:6px 12px;background:#fefce8;border:1px solid #fde047;font-weight:bold;">Complexity</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">Time: ${qr.complexity.time}, Space: ${qr.complexity.space}</td></tr>` : ""}
        </table>
        ${qr.strengths?.length > 0 ? `<p style="margin:6px 0 2px;font-weight:bold;color:#059669;">Strengths:</p><ul style="margin:0 0 8px 20px;">${qr.strengths.map((s: string) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
        ${qr.improvements?.length > 0 ? `<p style="margin:6px 0 2px;font-weight:bold;color:#d97706;">Areas for Improvement:</p><ul style="margin:0 0 8px 20px;">${qr.improvements.map((s: string) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
      ` : "";

      const codeHtml = isAttempted && qr.submittedCode
        ? `<p style="font-weight:bold;margin:8px 0 4px;">Submitted Code (${qr.language?.toUpperCase() || "—"}):</p>
           <pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;font-size:11px;font-family:'Fira Code',Consolas,monospace;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${escapeHtml(qr.submittedCode)}</pre>`
        : "";

      return `
        <div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid;">
          <h3 style="margin:0 0 8px;color:#1e40af;">Question ${idx + 1}: ${escapeHtml(qr.questionSnapshot?.title || "Problem")}</h3>
          <p style="margin:0;color:#6b7280;font-size:12px;">
            Difficulty: ${qr.questionSnapshot?.difficulty || "—"} &nbsp;|&nbsp;
            Status: <strong>${isAttempted ? "Completed" : "Not Attempted"}</strong> &nbsp;|&nbsp;
            Score: <strong>${qr.questionScore ?? 0}%</strong>
          </p>
          ${!isAttempted ? '<p style="color:#9ca3af;font-style:italic;margin:8px 0;">No solution was submitted for this problem.</p>' : ""}
          ${metricsHtml}
          ${codeHtml}
        </div>
      `;
    }).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1f2937; margin: 40px; line-height: 1.5; }
        h1 { color: #1e40af; font-size: 22px; margin-bottom: 4px; }
        h2 { color: #374151; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-top: 24px; }
        table { font-size: 12px; }
        pre { line-height: 1.4; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .summary-grid { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
        .summary-item { flex: 1; min-width: 120px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; text-align: center; }
        .summary-item .label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; }
        .summary-item .value { font-size: 20px; font-weight: 900; color: #1e40af; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SmartHire — Coding Assessment Transcript</h1>
        <p style="margin:0;color:#6b7280;font-size:12px;">Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</p>
      </div>

      <h2>Candidate Information</h2>
      <table>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name:</td><td>${escapeHtml(candidateName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email:</td><td>${escapeHtml(candidateEmail)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Job:</td><td>${escapeHtml(jobTitle)}</td></tr>
      </table>

      <h2>Assessment Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="label">Overall Score</div>
          <div class="value">${attempt.score ?? 0}%</div>
        </div>
        <div class="summary-item">
          <div class="label">Problems</div>
          <div class="value">${summary.attempted ?? 0} / ${summary.totalProblems ?? 0}</div>
        </div>
        <div class="summary-item">
          <div class="label">Tests Passed</div>
          <div class="value">${summary.passedTests ?? 0} / ${summary.totalTests ?? 0}</div>
        </div>
        <div class="summary-item">
          <div class="label">Time Used</div>
          <div class="value" style="font-size:14px;">${timeUsed}</div>
        </div>
        <div class="summary-item">
          <div class="label">Status</div>
          <div class="value" style="font-size:14px;color:${attempt.passed ? '#059669' : '#dc2626'};">${attempt.passed ? "PASSED" : "REVIEW"}</div>
        </div>
      </div>

      <h2>Per-Question Evaluation</h2>
      ${questionsHtml || '<p style="color:#9ca3af;">No question results available.</p>'}

      <div class="footer">
        <p>SmartHire Coding Assessment Transcript &bull; Submission ID: ${submissionId}</p>
        <p>This is an official assessment record. Do not modify.</p>
      </div>
    </body>
    </html>`;

    // Return as downloadable HTML (can be printed to PDF by browser)
    const safeName = candidateName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    const safeJob = jobTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="SmartHire_Coding_Transcript_${safeName}_${safeJob}.html"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error generating PDF transcript", err);
    return NextResponse.json({ error: "Failed to generate transcript", message }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
