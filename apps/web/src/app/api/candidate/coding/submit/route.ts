import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { evaluateCodeWithGemini, GeminiCodingEvaluationResult } from "@/services/ai/gemini-evaluator";
import { logger } from "@smarthire/logger";
import { executeUniversalCode } from "../run/route";

function normalizeOutput(output: string): string {
  return String(output ?? "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

function outputsMatch(actual: string, expected: string): boolean {
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);

  if (normExpected.length === 0) return false;
  if (normActual.toLowerCase() === normExpected.toLowerCase()) return true;

  const actualLines = normActual.toLowerCase().split("\n").filter(Boolean);
  const expectedLines = normExpected.toLowerCase().split("\n").filter(Boolean);

  if (actualLines.length === expectedLines.length) {
    const allMatch = actualLines.every((line, i) => line.trim() === expectedLines[i].trim());
    if (allMatch) return true;
  }

  if (!normActual.includes("\n") && !normExpected.includes("\n")) {
    const numActual = Number(normActual);
    const numExpected = Number(normExpected);
    if (!isNaN(numActual) && !isNaN(numExpected) && numActual === numExpected) return true;
  }

  return false;
}

// ─── Blank Submission Detection ───────────────────────────────────────────────

const STARTER_TEMPLATES_SIGNATURES = [
  "# Complete the solve function below",
  "# Write your solution logic here",
  "// Write your solution logic here",
  "return \"\"",
  'return ""',
  "return ''",
];

function isBlankSubmission(code: string, language?: string): boolean {
  if (!code) return true;

  // Strip all comments based on language
  let stripped = code;

  // Remove single-line comments
  stripped = stripped.replace(/\/\/.*$/gm, "");   // C-style
  stripped = stripped.replace(/#.*$/gm, "");        // Python-style

  // Remove multi-line comments
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");
  stripped = stripped.replace(/"""[\s\S]*?"""/g, "");
  stripped = stripped.replace(/'''[\s\S]*?'''/g, "");

  // Remove all whitespace
  const trimmed = stripped.replace(/\s+/g, "").trim();

  // Empty after stripping comments
  if (trimmed.length === 0) return true;

  // Check if code is ONLY the unchanged starter template
  const codeTrimmed = code.trim();
  const matchesStarter = STARTER_TEMPLATES_SIGNATURES.every((sig) =>
    codeTrimmed.includes(sig) || !codeTrimmed.includes("=") && trimmed.length < 120
  );

  // If ALL starter signatures present in the code AND no additional logic added
  const hasStarterOnly = STARTER_TEMPLATES_SIGNATURES.filter((sig) =>
    codeTrimmed.includes(sig)
  ).length >= 2;

  // Check: does the code contain ANY meaningful logic beyond boilerplate?
  // Remove common boilerplate patterns
  let meaningful = stripped;
  // Remove function/class declarations, imports, main guards
  meaningful = meaningful.replace(/def\s+\w+\([^)]*\)\s*(->\s*\w+)?\s*:/g, "");
  meaningful = meaningful.replace(/function\s+\w+\([^)]*\)\s*\{/g, "");
  meaningful = meaningful.replace(/class\s+\w+\s*\{/g, "");
  meaningful = meaningful.replace(/import\s+.+/g, "");
  meaningful = meaningful.replace(/using\s+.+;/g, "");
  meaningful = meaningful.replace(/#include\s+.+/g, "");
  meaningful = meaningful.replace(/if\s*\(__name__\s*==\s*['"]__main__['"]\)\s*:/g, "");
  meaningful = meaningful.replace(/public\s+static\s+void\s+main/g, "");
  meaningful = meaningful.replace(/static\s+void\s+Main/g, "");
  meaningful = meaningful.replace(/int\s+main\s*\(\)/g, "");
  meaningful = meaningful.replace(/return\s*["']{2}\s*;?/g, ""); // return "" or return ''
  meaningful = meaningful.replace(/return\s+0\s*;?/g, "");
  meaningful = meaningful.replace(/print\(solve\(sys\.stdin\.read\(\)\)\)/g, "");
  meaningful = meaningful.replace(/console\.log\(solve\(.+\)\)/g, "");
  meaningful = meaningful.replace(/Scanner\s+scanner\s*=\s*new\s+Scanner\(System\.in\)/g, "");
  meaningful = meaningful.replace(/[{}();]/g, "");
  const meaningfulTrimmed = meaningful.replace(/\s+/g, "").trim();

  if (meaningfulTrimmed.length < 5 && hasStarterOnly) return true;
  if (meaningfulTrimmed.length === 0) return true;

  return false;
}

// ─── Per-Question Evaluation Result ───────────────────────────────────────────

interface QuestionResult {
  questionId: string;
  questionSnapshot: {
    title: string;
    description: string;
    difficulty: string;
    constraints: string | string[];
    inputFormat: string;
    outputFormat: string;
    examples: Array<{ input: string; output: string }>;
    maxPoints: number;
  };
  status: "completed" | "not_attempted" | "compilation_error" | "runtime_error";
  language: string;
  submittedCode: string;
  functionalPct: number;
  passedTests: number;
  totalTests: number;
  testResults: Array<{
    id: string;
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
    hidden: boolean;
  }>;
  efficiency: { score: number | null; reason: string } | null;
  codeQuality: { score: number | null; reason: string } | null;
  readability: { score: number | null; reason: string } | null;
  robustness: { score: number | null; reason: string } | null;
  complexity: { time: string; space: string } | null;
  strengths: string[];
  improvements: string[];
  questionScore: number;
  maxPoints: number;
}

// ─── Scoring Weights ─────────────────────────────────────────────────────────

const WEIGHT_FUNCTIONAL = 0.70;
const WEIGHT_EFFICIENCY = 0.10;
const WEIGHT_CODE_QUALITY = 0.08;
const WEIGHT_ROBUSTNESS = 0.07;
const WEIGHT_READABILITY = 0.05;

function calculateWeightedScore(
  functionalPct: number,
  gemini: GeminiCodingEvaluationResult | null
): number {
  // Functional gating: if 0% functional, overall is 0%
  if (functionalPct === 0) return 0;

  const effScore = gemini?.efficiency ?? functionalPct;
  const qualScore = gemini?.codeQuality ?? functionalPct;
  const robScore = gemini?.robustness ?? functionalPct;
  const readScore = gemini?.readability ?? functionalPct;

  let raw = (
    functionalPct * WEIGHT_FUNCTIONAL +
    effScore * WEIGHT_EFFICIENCY +
    qualScore * WEIGHT_CODE_QUALITY +
    robScore * WEIGHT_ROBUSTNESS +
    readScore * WEIGHT_READABILITY
  );

  // Functional gating: if < 20% functional, cap qualitative contribution
  if (functionalPct < 20) {
    const qualContrib = (
      effScore * WEIGHT_EFFICIENCY +
      qualScore * WEIGHT_CODE_QUALITY +
      robScore * WEIGHT_ROBUSTNESS +
      readScore * WEIGHT_READABILITY
    );
    raw = functionalPct * WEIGHT_FUNCTIONAL + qualContrib * 0.3;
  }

  return Math.min(100, Math.max(0, Math.round(raw)));
}

// ─── Main POST Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAppClient();

    // 1. Authenticate candidate session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const { assignmentId, solutions, code, language, timeSpentSeconds } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    // Support both old single-solution format and new multi-solution format
    const solutionsList: Array<{ questionId: string; code: string; language: string }> =
      Array.isArray(solutions) && solutions.length > 0
        ? solutions
        : [{ questionId: "single", code: code || "", language: language || "python" }];

    logger.info(`[Coding Submit] Candidate ${user.id} submitting ${solutionsList.length} solutions for assignment ${assignmentId}`);

    // 2. Fetch assignment details
    const { data: assignment, error: assignErr } = await supabase
      .schema("assessment")
      .from("assignments")
      .select("id, assessment_id, application_id, candidate_id, company_id")
      .eq("id", assignmentId)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // 3. Fetch ALL coding questions for this assessment
    const { data: allQuestions } = await supabase
      .schema("assessment")
      .from("questions")
      .select("*")
      .eq("assessment_id", assignment.assessment_id);

    const questionRows = (allQuestions || []).filter((q) => q.question_type === "coding");
    if (questionRows.length === 0 && allQuestions && allQuestions.length > 0) {
      questionRows.push(...allQuestions);
    }

    // 4. Evaluate each question independently
    const questionResults: QuestionResult[] = [];
    let totalWeightedScore = 0;
    let totalMaxPoints = 0;
    let totalPassedTests = 0;
    let totalTests = 0;
    let attemptedCount = 0;

    for (const qRow of questionRows) {
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

      // Find candidate's solution for this question
      const sol = solutionsList.find((s) => s.questionId === questionId) ||
        (solutionsList.length === 1 ? solutionsList[0] : null);
      const candidateCode = sol?.code || "";
      const candidateLang = sol?.language || "python";

      // ── BLANK CHECK ──
      if (isBlankSubmission(candidateCode, candidateLang)) {
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

      // ── NON-BLANK: RUN TEST CASES ──
      attemptedCount++;
      let earnedWeight = 0;
      let totalWeight = 0;
      let passedCount = 0;
      const testResults: QuestionResult["testResults"] = [];

      for (const tc of allTestCases) {
        const tcWeight = tc.weight ? Number(tc.weight) : 10;
        totalWeight += tcWeight;

        const inputStr = String(tc.input ?? "").trim();
        const expectedStr = String(tc.expectedOutput ?? "").trim();

        let actualOutput = "";
        let executionFailed = false;
        try {
          actualOutput = executeUniversalCode(candidateCode, candidateLang, inputStr);
        } catch {
          executionFailed = true;
        }

        const isPassed = !executionFailed && outputsMatch(actualOutput, expectedStr);

        if (isPassed) {
          passedCount++;
          earnedWeight += tcWeight;
        }

        testResults.push({
          id: tc.id || `tc-${testResults.length}`,
          input: tc.hidden ? "[HIDDEN]" : inputStr,
          expected: tc.hidden ? "[HIDDEN]" : expectedStr,
          actual: tc.hidden ? (isPassed ? "[PASSED]" : "[FAILED]") : actualOutput,
          passed: isPassed,
          hidden: Boolean(tc.hidden),
        });
      }

      const functionalPct = totalWeight > 0
        ? Math.round((earnedWeight / totalWeight) * 100)
        : (allTestCases.length > 0 ? Math.round((passedCount / allTestCases.length) * 100) : 0);

      totalPassedTests += passedCount;
      totalTests += allTestCases.length;

      // ── GEMINI EVALUATION (only for non-blank, non-zero-functional or substantial code) ──
      let geminiResult: GeminiCodingEvaluationResult | null = null;

      // Only call Gemini if there's meaningful code to evaluate
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
      } catch (err) {
        logger.warn("[Coding Submit] Gemini evaluation error, proceeding with deterministic score", err);
      }

      const questionScore = calculateWeightedScore(functionalPct, geminiResult);

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
        efficiency: geminiResult?.efficiency != null
          ? { score: geminiResult.efficiency, reason: geminiResult.reasoning || "" }
          : null,
        codeQuality: geminiResult?.codeQuality != null
          ? { score: geminiResult.codeQuality, reason: geminiResult.reasoning || "" }
          : null,
        readability: geminiResult?.readability != null
          ? { score: geminiResult.readability, reason: geminiResult.reasoning || "" }
          : null,
        robustness: geminiResult?.robustness != null
          ? { score: geminiResult.robustness, reason: geminiResult.reasoning || "" }
          : null,
        complexity: geminiResult?.complexity || null,
        strengths: geminiResult?.strengths || [],
        improvements: geminiResult?.improvements || [],
        questionScore,
        maxPoints,
      });

      totalWeightedScore += questionScore * maxPoints;
      totalMaxPoints += maxPoints;
    }

    // 5. Calculate overall assessment score
    const overallScore = totalMaxPoints > 0
      ? Math.round(totalWeightedScore / totalMaxPoints)
      : 0;
    const passed = overallScore >= 60;
    const finalScore10 = Math.round((overallScore / 10) * 10) / 10;

    const now = new Date().toISOString();

    // 6. Build assessment summary
    const assessmentSummary = {
      totalProblems: questionRows.length,
      attempted: attemptedCount,
      totalTests,
      passedTests: totalPassedTests,
      overallScore,
      duration: Number(timeSpentSeconds) || 0,
      timeUsedSeconds: Number(timeSpentSeconds) || 0,
      submittedAt: now,
      status: "completed" as const,
    };

    // Build backward-compatible answers payload + new per-question data
    const firstAttempted = questionResults.find((q) => q.status === "completed") || questionResults[0];
    const answersPayload = {
      // Legacy single-question fields (backward compatible)
      code: firstAttempted?.submittedCode || "",
      language: firstAttempted?.language || "python",
      deterministicScorePct: firstAttempted?.functionalPct || 0,
      functionalPct: firstAttempted?.functionalPct || 0,
      codeQualityPct: firstAttempted?.codeQuality?.score ?? 0,
      efficiencyPct: firstAttempted?.efficiency?.score ?? 0,
      readabilityPct: firstAttempted?.readability?.score ?? 0,
      robustnessPct: firstAttempted?.robustness?.score ?? 0,
      passedCases: totalPassedTests,
      totalCases: totalTests,
      finalScorePct: overallScore,
      geminiResult: firstAttempted ? {
        codeQuality: firstAttempted.codeQuality?.score ?? null,
        efficiency: firstAttempted.efficiency?.score ?? null,
        readability: firstAttempted.readability?.score ?? null,
        robustness: firstAttempted.robustness?.score ?? null,
        strengths: firstAttempted.strengths,
        improvements: firstAttempted.improvements,
        timeComplexity: firstAttempted.complexity?.time || null,
        spaceComplexity: firstAttempted.complexity?.space || null,
        aiScore: firstAttempted.questionScore,
        reasoning: firstAttempted.codeQuality?.reason || "",
      } : null,
      // New per-question transcript data
      questionResults,
      assessmentSummary,
    };

    // 7. Persist result
    const attemptPayload = {
      score: overallScore,
      correctness_score: Math.round((totalPassedTests / Math.max(1, totalTests)) * 10),
      code_quality_score: firstAttempted?.codeQuality?.score != null
        ? Math.round(firstAttempted.codeQuality.score / 10)
        : 0,
      time_spent_seconds: Number(timeSpentSeconds) || 0,
      status: "completed",
      completed_at: now,
      passed,
      answers: answersPayload,
    };

    const { data: existingAttempt } = await supabase
      .schema("assessment")
      .from("attempts")
      .select("id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (existingAttempt) {
      await supabase
        .schema("assessment")
        .from("attempts")
        .update(attemptPayload)
        .eq("id", existingAttempt.id);
    } else {
      await supabase
        .schema("assessment")
        .from("attempts")
        .insert({
          assignment_id: assignmentId,
          assessment_id: assignment.assessment_id,
          candidate_id: assignment.candidate_id,
          started_at: new Date(Date.now() - (timeSpentSeconds || 60) * 1000).toISOString(),
          ...attemptPayload,
        });
    }

    // 8. Update assignment status
    await supabase
      .schema("assessment")
      .from("assignments")
      .update({ status: "completed" })
      .eq("id", assignmentId);

    // 9. Update application stage scores
    if (assignment.application_id) {
      await supabase
        .from("applications")
        .update({
          coding_score: finalScore10,
          coding_total: 10,
          coding_passed: passed,
        })
        .eq("id", assignment.application_id);
    }

    logger.info(`[Coding Submit] Assessment completed: overall=${overallScore}%, attempted=${attemptedCount}/${questionRows.length}, tests=${totalPassedTests}/${totalTests}`);

    return NextResponse.json({
      success: true,
      score10: finalScore10,
      finalScorePct: overallScore,
      deterministicScorePct: firstAttempted?.functionalPct || 0,
      passed,
      passedCases: totalPassedTests,
      totalCases: totalTests,
      questionResults,
      assessmentSummary,
      geminiEvaluation: answersPayload.geminiResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("API error in candidate coding submit route", err);
    return NextResponse.json({ error: "Failed to submit coding exam", message }, { status: 500 });
  }
}
