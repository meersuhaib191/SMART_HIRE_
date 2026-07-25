import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { evaluateCodeWithGemini } from "@/services/ai/gemini-evaluator";
import { executeUniversalCode } from "@/app/api/candidate/coding/run/route";
import { normalizeStdinInput, compareOutputs } from "@/utils/code-comparator";
import { logger } from "@smarthire/logger";

/**
 * POST /api/recruiter/assessments/re-evaluate
 *
 * Authorized action allowing recruiters to re-evaluate past candidate submissions
 * using the corrected, deterministic evidence-based evaluation pipeline.
 *
 * Rules:
 * - Uses ORIGINAL submitted code (candidate cannot change code)
 * - Uses ORIGINAL question test set / snapshot
 * - Preserves audit history (logs old score vs new score)
 * - Updates application coding scores
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAppClient();

    // 1. Authenticate recruiter
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { attemptId } = await request.json();
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    // 2. Fetch target attempt
    const { data: attempt, error: attErr } = await supabase
      .schema("assessment")
      .from("attempts")
      .select("*")
      .eq("id", attemptId)
      .single();

    if (attErr || !attempt) {
      return NextResponse.json({ error: "Attempt record not found" }, { status: 404 });
    }

    // 3. Fetch assignment & verify recruiter authorization
    const { data: assignment } = await supabase
      .schema("assessment")
      .from("assignments")
      .select("company_id, application_id, assessment_id")
      .eq("id", attempt.assignment_id)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const { data: recruiterProfile } = await supabase
      .schema("recruiter")
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!recruiterProfile || recruiterProfile.company_id !== assignment.company_id) {
      return NextResponse.json({ error: "Unauthorized to re-evaluate this submission" }, { status: 403 });
    }

    const oldScore = attempt.score ?? 0;
    const ans = attempt.answers || {};

    // 4. Fetch questions
    const { data: questions } = await supabase
      .schema("assessment")
      .from("questions")
      .select("*")
      .eq("assessment_id", assignment.assessment_id);

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "Assessment questions not found" }, { status: 404 });
    }

    // Re-evaluate each question
    const questionResults: any[] = [];
    let totalWeightedScore = 0;
    let totalMaxPoints = 0;
    let totalPassedTests = 0;
    let totalTests = 0;
    let attemptedCount = 0;

    for (const qRow of questions) {
      const opts = typeof qRow.options === "object" && qRow.options !== null ? qRow.options : {};
      const questionId = qRow.id;
      const title = opts.title || qRow.title || "Coding Problem";
      const description = opts.description || qRow.question_text || "";
      const difficulty = qRow.difficulty || "medium";
      const constraints = opts.constraints || [];
      const inputFormat = opts.inputFormat || "";
      const outputFormat = opts.outputFormat || "";
      const examples = opts.examples || [];
      const maxPoints = qRow.points ? Number(qRow.points) : 10;
      const allTestCases: Array<{ id: string; input: string; expectedOutput: string; hidden?: boolean; weight?: number }> = opts.testCases || [];

      // Extract original submitted code for this question
      let candidateCode = "";
      let candidateLang = ans.language || "python";

      if (Array.isArray(ans.questionResults)) {
        const qPrev = ans.questionResults.find((q: any) => q.questionId === questionId);
        if (qPrev) {
          candidateCode = qPrev.submittedCode || "";
          candidateLang = qPrev.language || candidateLang;
        }
      }

      if (!candidateCode) {
        candidateCode = ans.code || "";
      }

      // ── BLANK CHECK ──
      const isBlank = !candidateCode || candidateCode.trim().length === 0 || candidateCode.includes("# Complete the solve function");
      if (isBlank) {
        questionResults.push({
          questionId,
          questionSnapshot: { title, description, difficulty, constraints, inputFormat, outputFormat, examples, maxPoints },
          status: "not_attempted",
          language: candidateLang,
          submittedCode: candidateCode,
          functionalPct: 0,
          passedTests: 0,
          totalTests: allTestCases.length,
          testResults: [],
          efficiency: null,
          codeQuality: null,
          readability: null,
          robustness: null,
          complexity: null,
          strengths: [],
          improvements: [],
          questionScore: 0,
          maxPoints,
        });
        totalTests += allTestCases.length;
        totalMaxPoints += maxPoints;
        continue;
      }

      // ── RUN TEST CASES ──
      attemptedCount++;
      let earnedWeight = 0;
      let totalWeight = 0;
      let passedCount = 0;
      const testResults: any[] = [];

      for (const tc of allTestCases) {
        const tcWeight = tc.weight ? Number(tc.weight) : 10;
        totalWeight += tcWeight;

        const normInput = normalizeStdinInput(tc.input);
        const expectedStr = String(tc.expectedOutput ?? "").trim();

        const execRes = executeUniversalCode(candidateCode, candidateLang, normInput);
        let isPassed = false;
        let testStatus = execRes.status;

        if (execRes.status === "ACCEPTED") {
          const comp = compareOutputs(execRes.stdout, expectedStr, opts.comparisonOptions);
          isPassed = comp.passed;
          testStatus = isPassed ? "ACCEPTED" : "WRONG_ANSWER";
        }

        if (isPassed) {
          passedCount++;
          earnedWeight += tcWeight;
        }

        testResults.push({
          id: tc.id || `tc-${testResults.length}`,
          input: tc.hidden ? "[HIDDEN]" : normInput,
          expected: tc.hidden ? "[HIDDEN]" : expectedStr,
          actual: tc.hidden ? (isPassed ? "[PASSED]" : "[FAILED]") : execRes.stdout,
          passed: isPassed,
          hidden: Boolean(tc.hidden),
        });
      }

      const functionalPct = totalWeight > 0
        ? Math.round((earnedWeight / totalWeight) * 100)
        : (allTestCases.length > 0 ? Math.round((passedCount / allTestCases.length) * 100) : 0);

      totalPassedTests += passedCount;
      totalTests += allTestCases.length;

      // ── GEMINI EVALUATION ──
      let geminiResult = null;
      if (functionalPct > 0) {
        const testSummary = `Passed ${passedCount} of ${allTestCases.length} test cases. Functional correctness: ${functionalPct}%.`;
        try {
          geminiResult = await evaluateCodeWithGemini({
            problemTitle: title,
            problemDescription: description,
            candidateCode,
            language: candidateLang,
            testResultsSummary: testSummary,
            constraints: Array.isArray(constraints) ? constraints.join(", ") : String(constraints),
          });
        } catch {}
      }

      let questionScore = functionalPct === 0 ? 0 : Math.round(
        functionalPct * 0.70 +
        (geminiResult?.efficiency ?? functionalPct) * 0.10 +
        (geminiResult?.codeQuality ?? functionalPct) * 0.08 +
        (geminiResult?.robustness ?? functionalPct) * 0.07 +
        (geminiResult?.readability ?? functionalPct) * 0.05
      );

      questionResults.push({
        questionId,
        questionSnapshot: { title, description, difficulty, constraints, inputFormat, outputFormat, examples, maxPoints },
        status: "completed",
        language: candidateLang,
        submittedCode: candidateCode,
        functionalPct,
        passedTests: passedCount,
        totalTests: allTestCases.length,
        testResults,
        efficiency: geminiResult?.efficiency != null ? { score: geminiResult.efficiency, reason: geminiResult.reasoning } : null,
        codeQuality: geminiResult?.codeQuality != null ? { score: geminiResult.codeQuality, reason: geminiResult.reasoning } : null,
        readability: geminiResult?.readability != null ? { score: geminiResult.readability, reason: geminiResult.reasoning } : null,
        robustness: geminiResult?.robustness != null ? { score: geminiResult.robustness, reason: geminiResult.reasoning } : null,
        complexity: geminiResult?.complexity || null,
        strengths: geminiResult?.strengths || [],
        improvements: geminiResult?.improvements || [],
        questionScore,
        maxPoints,
      });

      totalWeightedScore += questionScore * maxPoints;
      totalMaxPoints += maxPoints;
    }

    const newScore = totalMaxPoints > 0 ? Math.round(totalWeightedScore / totalMaxPoints) : 0;
    const newPassed = newScore >= 60;
    const newScore10 = Math.round((newScore / 10) * 10) / 10;
    const now = new Date().toISOString();

    const updatedAnswers = {
      ...ans,
      questionResults,
      assessmentSummary: {
        totalProblems: questions.length,
        attempted: attemptedCount,
        totalTests,
        passedTests: totalPassedTests,
        overallScore: newScore,
        submittedAt: attempt.completed_at || now,
        reEvaluatedAt: now,
        status: "completed",
      },
      finalScorePct: newScore,
      passedCases: totalPassedTests,
      totalCases: totalTests,
      reEvaluatedAt: now,
    };

    // Update attempt
    await supabase
      .schema("assessment")
      .from("attempts")
      .update({
        score: newScore,
        passed: newPassed,
        answers: updatedAnswers,
      })
      .eq("id", attemptId);

    // Update application
    if (assignment.application_id) {
      await supabase
        .from("applications")
        .update({
          coding_score: newScore10,
          coding_total: 10,
          coding_passed: newPassed,
        })
        .eq("id", assignment.application_id);
    }

    logger.info(`[Re-Evaluation] Attempt ${attemptId} re-evaluated by ${user.id}. Score: ${oldScore}% -> ${newScore}%`);

    return NextResponse.json({
      success: true,
      attemptId,
      oldScore,
      newScore,
      newPassed,
      passedCases: totalPassedTests,
      totalCases: totalTests,
      reEvaluatedAt: now,
      questionResults,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Error in re-evaluation route", err);
    return NextResponse.json({ error: "Re-evaluation failed", message }, { status: 500 });
  }
}
