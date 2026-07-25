import { logger } from "@smarthire/logger";
import { AtsScoreBreakdown } from "@/services/ats/ats-engine";
import { generateStructuredGeminiResponse } from "./gemini-service";

export interface GeminiAtsSuggestions {
  strengths: string[];
  missingSkills: string[];
  experienceAlignment: string[];
  projectRecommendations: string[];
  resumeImprovements: string[];
  available: boolean;
  status: "completed" | "key_missing" | "auth_failed" | "rate_limited" | "timeout" | "invalid_response" | "api_error" | "unavailable";
  notice?: string;
}

interface RawGeminiAtsOutput {
  strengths?: string[];
  missingSkills?: string[];
  experienceAlignment?: string[];
  projectRecommendations?: string[];
  resumeImprovements?: string[];
}

/**
 * Generates tailored resume improvement suggestions using Gemini API server-side.
 * Operates gracefully: if Gemini API is unconfigured, times out, or fails, returns available: false
 * with notice so the ATS Check score remains completely functional and valid.
 */
export async function generateGeminiAtsSuggestions(params: {
  resumeText: string;
  jdText: string;
  jobTitle?: string;
  atsBreakdown: AtsScoreBreakdown;
}): Promise<GeminiAtsSuggestions> {
  const startTime = Date.now();
  const prompt = `You are an expert ATS Career Coach and Executive Resume Strategist.
Analyze the candidate's resume content against the target job description.

### Target Job Title:
${params.jobTitle || "Target Job Opening"}

### Job Description Content:
${params.jdText.slice(0, 2500)}

### Candidate Resume Content:
${params.resumeText.slice(0, 2500)}

### Detected ATS Data:
- Matched Required Skills: ${params.atsBreakdown.matchedSkills.join(", ") || "None"}
- Missing Required Skills: ${params.atsBreakdown.missingSkills.join(", ") || "None"}
- Deterministic ATS Match Score: ${params.atsBreakdown.atsScore}/100

### CRITICAL REQUIREMENTS:
1. Ground every recommendation specifically in the candidate's actual resume text and JD requirements.
2. NEVER tell the candidate to fabricate experience or keyword-stuff skills they do not possess.
3. For missing skills (e.g. AWS, Power BI), advise: "[Skill] is requested by this job but was not detected in your resume. Add it only if you genuinely have experience; otherwise consider learning it."
4. Provide concrete, project-specific and bullet-level improvement advice.

Return ONLY valid JSON matching this schema:
{
  "strengths": [
    "Contextual strength based on candidate's real resume"
  ],
  "missingSkills": [
    "Skill gap advice with non-fabrication guidance"
  ],
  "experienceAlignment": [
    "How candidate's work experience compares to JD demands"
  ],
  "projectRecommendations": [
    "Specific improvement for a project mentioned in candidate's resume"
  ],
  "resumeImprovements": [
    "Actionable bullet formatting, metric quantification, or wording advice"
  ]
}`;

  const result = await generateStructuredGeminiResponse<RawGeminiAtsOutput>({
    prompt,
    timeoutMs: 12000,
    temperature: 0.2,
  });

  const durationMs = Date.now() - startTime;

  if (!result.success || !result.data) {
    let internalStatus: GeminiAtsSuggestions["status"] = "unavailable";
    switch (result.errorCategory) {
      case "GEMINI_KEY_MISSING":
        internalStatus = "key_missing";
        break;
      case "GEMINI_AUTH_FAILED":
        internalStatus = "auth_failed";
        break;
      case "GEMINI_RATE_LIMITED":
        internalStatus = "rate_limited";
        break;
      case "GEMINI_TIMEOUT":
        internalStatus = "timeout";
        break;
      case "GEMINI_INVALID_RESPONSE":
        internalStatus = "invalid_response";
        break;
      default:
        internalStatus = "api_error";
        break;
    }

    logger.warn(
      `[GeminiAtsSuggester] Gemini ATS suggestions unavailable (status=${internalStatus}, duration=${durationMs}ms): ${result.errorMessage}`
    );

    return {
      strengths: [],
      missingSkills: [],
      experienceAlignment: [],
      projectRecommendations: [],
      resumeImprovements: [],
      available: false,
      status: internalStatus,
      notice: "AI resume suggestions are temporarily unavailable. Your ATS analysis is still available below.",
    };
  }

  const data = result.data;
  logger.info(`[GeminiAtsSuggester] Gemini suggestions successfully calculated in ${durationMs}ms`);

  return {
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
    experienceAlignment: Array.isArray(data.experienceAlignment) ? data.experienceAlignment : [],
    projectRecommendations: Array.isArray(data.projectRecommendations) ? data.projectRecommendations : [],
    resumeImprovements: Array.isArray(data.resumeImprovements) ? data.resumeImprovements : [],
    available: true,
    status: "completed",
  };
}
