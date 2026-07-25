import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { logger } from "@smarthire/logger";

/**
 * GET /api/assessments/[submissionId]/interview-transcript/pdf
 *
 * Generates and returns a professional, downloadable printable HTML/PDF document
 * containing the official candidate AI Live Interview transcript & evaluation breakdown.
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

    // Authorization: candidate or recruiter
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
    const evalData = ans.evaluation || {};
    const transcriptTurns: any[] = Array.isArray(ans.transcript) ? ans.transcript : [];

    const timeUsed = attempt.time_spent_seconds
      ? `${Math.floor(attempt.time_spent_seconds / 60)}m ${attempt.time_spent_seconds % 60}s`
      : "—";

    const transcriptHtml = transcriptTurns.map((turn: any) => `
      <div style="margin: 10px 0; padding: 10px 14px; border-left: 3px solid ${turn.speaker === 'interviewer' ? '#2563eb' : '#059669'}; background: ${turn.speaker === 'interviewer' ? '#f0f9ff' : '#f0fdf4'}; border-radius: 6px;">
        <div style="font-[10px]; font-weight: bold; color: ${turn.speaker === 'interviewer' ? '#1e40af' : '#047857'}; text-transform: uppercase;">
          ${turn.speaker === 'interviewer' ? 'SmartHire AI Interviewer' : escapeHtml(candidateName)} &bull; <span style="font-weight:normal;color:#6b7280;">[${escapeHtml(turn.timeFormatted || '00:00')}]</span>
        </div>
        <div style="margin-top: 4px; font-size: 13px; color: #1f2937;">${escapeHtml(turn.text)}</div>
      </div>
    `).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SmartHire AI Live Interview Transcript</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1f2937; margin: 40px; line-height: 1.5; }
        h1 { color: #1e40af; font-size: 22px; margin-bottom: 4px; }
        h2 { color: #374151; font-size: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-top: 24px; }
        table { font-size: 12px; width: 100%; border-collapse: collapse; }
        .summary-grid { display: flex; gap: 12px; margin: 16px 0; }
        .summary-item { flex: 1; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; background: #f9fafb; }
        .summary-item .label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: bold; }
        .summary-item .value { font-size: 22px; font-weight: 900; color: #1e40af; }
        .rubric-table td { padding: 8px 12px; border: 1px solid #e5e7eb; }
        .rubric-header { background: #f3f4f6; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #4b5563; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <div style="border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
        <h1>SmartHire — AI Live Interview Transcript</h1>
        <p style="margin:0;color:#6b7280;font-size:12px;">Official Assessment Transcript &bull; Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</p>
      </div>

      <h2>Candidate Information</h2>
      <table>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;width:120px;">Name:</td><td>${escapeHtml(candidateName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email:</td><td>${escapeHtml(candidateEmail)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Assessment:</td><td>AI Live Technical Interview</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Submitted At:</td><td>${attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : '—'}</td></tr>
      </table>

      <h2>Evaluation Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="label">Overall Score</div>
          <div class="value">${attempt.score ?? 0}%</div>
        </div>
        <div class="summary-item">
          <div class="label">Time Spent</div>
          <div class="value" style="font-size:16px;">${timeUsed}</div>
        </div>
        <div class="summary-item">
          <div class="label">Result</div>
          <div class="value" style="font-size:16px;color:${attempt.passed ? '#059669' : '#dc2626'};">${attempt.passed ? "PASSED" : "REVIEW"}</div>
        </div>
      </div>

      <h2>Competency Rubric Breakdown</h2>
      <table class="rubric-table">
        <tr class="rubric-header">
          <td>Competency Dimension</td>
          <td>Weight</td>
          <td>Score</td>
          <td>Reasoning & Evidence</td>
        </tr>
        <tr>
          <td><strong>Technical Competence</strong></td>
          <td>40%</td>
          <td><strong style="color:#2563eb;">${evalData.technicalCompetence?.score ?? '—'}%</strong></td>
          <td>${escapeHtml(evalData.technicalCompetence?.reasoning || 'Evaluated against job requirements')}</td>
        </tr>
        <tr>
          <td><strong>Problem Solving & Reasoning</strong></td>
          <td>20%</td>
          <td><strong style="color:#2563eb;">${evalData.problemSolving?.score ?? '—'}%</strong></td>
          <td>${escapeHtml(evalData.problemSolving?.reasoning || 'Evaluated against trade-off explanations')}</td>
        </tr>
        <tr>
          <td><strong>Communication Clarity</strong></td>
          <td>15%</td>
          <td><strong style="color:#2563eb;">${evalData.communication?.score ?? '—'}%</strong></td>
          <td>${escapeHtml(evalData.communication?.reasoning || 'Evaluated response structure')}</td>
        </tr>
        <tr>
          <td><strong>Applied Experience</strong></td>
          <td>15%</td>
          <td><strong style="color:#2563eb;">${evalData.appliedExperience?.score ?? '—'}%</strong></td>
          <td>${escapeHtml(evalData.appliedExperience?.reasoning || 'Evaluated practical application')}</td>
        </tr>
        <tr>
          <td><strong>Professional Judgment</strong></td>
          <td>10%</td>
          <td><strong style="color:#2563eb;">${evalData.professionalJudgment?.score ?? '—'}%</strong></td>
          <td>${escapeHtml(evalData.professionalJudgment?.reasoning || 'Evaluated decision ownership')}</td>
        </tr>
      </table>

      <h2>Complete Conversational Transcript</h2>
      ${transcriptHtml || '<p style="color:#9ca3af;font-style:italic;">No transcript turns recorded.</p>'}

      <div class="footer">
        <p>SmartHire AI Live Interview System &bull; Submission ID: ${submissionId}</p>
        <p>This is an official assessment record. Do not alter.</p>
      </div>
    </body>
    </html>`;

    const safeName = candidateName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="SmartHire_AI_Interview_Transcript_${safeName}.html"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error generating interview PDF transcript", err);
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
