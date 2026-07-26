import { logger } from "@smarthire/logger";
import { generateStructuredGeminiResponse } from "./gemini-service";

export interface GeminiCodingEvaluationResult {
  success: boolean;
  codeQuality: number | null;     // 0-100
  efficiency: number | null;      // 0-100
  readability: number | null;     // 0-100
  robustness: number | null;      // 0-100
  reasoning: string;
  complexity?: { time: string; space: string } | null;
  strengths?: string[];
  improvements?: string[];
  aiScore: number | null;         // 0-100
  error?: string;
}

interface RawGeminiOutput {
  codeQuality: number;
  efficiency: number;
  readability: number;
  robustness: number;
  reasoning: string;
  complexity: { time: string; space: string };
  strengths: string[];
  improvements: string[];
  aiScore: number;
}

/**
 * Evaluates candidate submitted code using central Gemini API server-side.
 * Returns strict structured evaluation JSON.
 *
 * CRITICAL RULES:
 * - NEVER called for blank/empty submissions (caller must guard)
 * - On failure returns success: false with NULL metrics (not fabricated scores)
 * - Gemini is evidence-bound: must not invent test results or correctness
 */
export async function evaluateCodeWithGemini(params: {
  problemTitle: string;
  problemDescription: string;
  candidateCode: string;
  language: string;
  testResultsSummary: string;
  constraints?: string;
  referenceSolutionHint?: string;
}): Promise<GeminiCodingEvaluationResult> {
  const prompt = `You are an expert Senior Software Engineer and Code Auditor evaluating a candidate's coding assessment submission.

CRITICAL EVIDENCE RULES:
- Only evaluate evidence present in the submitted code, problem definition, constraints, and execution results.
- Do NOT infer functionality not demonstrated by the code.
- Do NOT award correctness points (correctness is determined by test cases, not you).
- Do NOT invent passed test cases or runtime measurements.
- Do NOT award high metrics when evidence is insufficient.
- If the code barely functions, scores should reflect that.

### Problem Title:
${params.problemTitle}

### Problem Description:
${params.problemDescription}
${params.constraints ? `\n### Constraints:\n${params.constraints}` : ""}

### Candidate Code Submission (${params.language}):
\`\`\`${params.language}
${params.candidateCode}
\`\`\`

### Deterministic Test Case Execution Results:
${params.testResultsSummary}
${params.referenceSolutionHint ? `\n### Reference Approach Hint (for complexity comparison only — candidate may use ANY valid approach):\n${params.referenceSolutionHint}` : ""}

### Task:
Evaluate the submission on these dimensions (0 to 100 scale):

1. codeQuality (0-100): Modularity, structure, variable naming, duplication, language conventions
2. efficiency (0-100): Time and space complexity suitability given the problem constraints
3. readability (0-100): Code formatting, clarity, naming, organization
4. robustness (0-100): Defensive handling, edge-case awareness based on code structure (NOT test results)

Also provide:
- complexity: { time: "O(...)", space: "O(...)" } — approximate Big-O analysis
- strengths: array of 1-3 specific strengths observed in the code
- improvements: array of 1-3 specific improvement suggestions
- reasoning: 2-3 sentence overall assessment
- aiScore: overall qualitative score 0-100 (NOT including test-case correctness)

Return ONLY valid JSON matching this schema:
{
  "codeQuality": 75,
  "efficiency": 80,
  "readability": 85,
  "robustness": 60,
  "complexity": { "time": "O(n)", "space": "O(n)" },
  "strengths": ["Uses hash map for O(1) lookup", "Clean variable naming"],
  "improvements": ["Add input validation", "Could use early termination"],
  "reasoning": "Candidate implemented an efficient approach with clear structure...",
  "aiScore": 75
}`;

  const result = await generateStructuredGeminiResponse<RawGeminiOutput>({
    prompt,
    timeoutMs: 4000,
    temperature: 0.2,
  });

  if (!result.success || !result.data) {
    logger.warn(`[GeminiEvaluator] Gemini evaluation failed: ${result.errorMessage}`);
    // CRITICAL: Return null metrics, NOT fabricated scores
    return {
      success: false,
      codeQuality: null,
      efficiency: null,
      readability: null,
      robustness: null,
      reasoning: "AI qualitative evaluation unavailable. Score based on deterministic test-case results only.",
      complexity: null,
      strengths: [],
      improvements: [],
      aiScore: null,
      error: result.errorMessage,
    };
  }

  const d = result.data;

  // Validate and clamp all scores to 0-100
  const clamp = (v: any): number | null => {
    if (v === null || v === undefined || isNaN(Number(v))) return null;
    return Math.max(0, Math.min(100, Math.round(Number(v))));
  };

  return {
    success: true,
    codeQuality: clamp(d.codeQuality),
    efficiency: clamp(d.efficiency),
    readability: clamp(d.readability),
    robustness: clamp(d.robustness),
    reasoning: d.reasoning || "Code evaluation complete.",
    complexity: d.complexity && d.complexity.time ? d.complexity : null,
    strengths: Array.isArray(d.strengths) ? d.strengths.slice(0, 5) : [],
    improvements: Array.isArray(d.improvements) ? d.improvements.slice(0, 5) : [],
    aiScore: clamp(d.aiScore),
  };
}
