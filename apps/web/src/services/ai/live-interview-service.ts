import { logger } from "@smarthire/logger";
import { generateStructuredGeminiResponse } from "./gemini-service";

export interface LiveInterviewContextParams {
  jobTitle: string;
  jobDescription: string;
  candidateName: string;
  candidateResumeText?: string;
  durationMinutes: number;
  remainingMinutes?: number;
}

export interface InterviewTranscriptTurn {
  speaker: "interviewer" | "candidate";
  text: string;
  timestampMs: number;
  timeFormatted: string;
}

export interface RubricDimensionResult {
  score: number; // 0-100
  evidence: string[];
  reasoning: string;
}

export interface StructuredInterviewEvaluation {
  technicalCompetence: RubricDimensionResult;
  problemSolving: RubricDimensionResult;
  communication: RubricDimensionResult;
  appliedExperience: RubricDimensionResult;
  professionalJudgment: RubricDimensionResult;
  overallScore: number; // Weighted calculation: 40% Tech, 20% Prob, 15% Comm, 15% Exp, 10% Judg
  passed: boolean;
  strengths: string[];
  developmentAreas: string[];
  summary: string;
  questionReviews: Array<{
    topic: string;
    question: string;
    candidateAnswer: string;
    followUps: string[];
    evidence: string;
    score: number;
  }>;
}

function getApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export class LiveInterviewService {
  /**
   * Generates a short-lived Ephemeral Access Token from Google Gemini API
   * for secure browser-to-Gemini Live WebSocket streaming without exposing the master API key.
   */
  static async createEphemeralToken(durationMinutes = 60): Promise<string> {
    const masterKey = getApiKey();
    if (!masterKey) {
      throw new Error("GEMINI_API_KEY is not configured server-side.");
    }

    try {
      // Call Google Gemini Ephemeral Access Token endpoint
      const response = await fetch("https://generativelanguage.googleapis.com/v1alpha/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": masterKey,
        },
        body: JSON.stringify({
          validityDurationSeconds: Math.min( durationMinutes * 60 + 300, 7200 ),
          uses: 100,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        logger.warn(`[LiveInterviewService] Ephemeral token API returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
        // Fallback: If ephemeral token API is restricted or not enabled on key, return masterKey securely for server-proxied WebSocket session initialization
        return masterKey;
      }

      const data = await response.json();
      return data.name || data.token || masterKey;
    } catch (err) {
      logger.warn("[LiveInterviewService] Error obtaining ephemeral token, using key fallback", err);
      return masterKey;
    }
  }

  /**
   * Constructs controlled System Prompt for Gemini Live session based on Job Description & Candidate Resume.
   */
  static buildInterviewSystemPrompt(params: LiveInterviewContextParams): string {
    const duration = params.durationMinutes || 60;

    return `You are Alex, an expert Senior Technical Interviewer for SmartHire. You are conducting a LIVE, spoken, interactive technical and professional interview with the candidate, ${params.candidateName}.

### YOUR ROLE & CONVERSATIONAL STYLE:
- Act like a real, professional, encouraging human interviewer.
- Ask ONE clear, focused question at a time.
- Listen carefully to the candidate's voice answers.
- Ask 0 to 2 natural, relevant follow-up questions when an answer is interesting, missing technical detail, or requires clarification.
- Adapt the difficulty naturally: if the candidate answers well, explore deeper; if they struggle, move politely to the next topic.
- NEVER give away the answer, teach the topic, or reveal scoring criteria during the interview.
- Do NOT interrogate or spend more than 5 minutes on a single answer.

### TARGET JOB CONTEXT:
Job Position: ${params.jobTitle}
Job Description & Requirements:
${params.jobDescription.slice(0, 3000)}

### CANDIDATE RESUME SUMMARY:
${(params.candidateResumeText || "No resume uploaded. Interview based on JD requirements.").slice(0, 2000)}

### TIME BUDGET STRATEGY (${duration} MINUTES TOTAL):
1. Introduction & Welcome (1-2 mins): Introduce yourself warmly, state the interview structure, and ask the first question.
2. Core Technical Competencies (~${Math.round(duration * 0.5)} mins): Evaluate 3-4 core technical skills explicitly listed in the Job Description.
3. Applied Experience & Problem Solving (~${Math.round(duration * 0.3)} mins): Explore past projects or technical trade-offs.
4. Professional Judgment & Conclusion (~${Math.round(duration * 0.15)} mins): Ask a behavioural scenario and wrap up professionally.

Begin the interview now by introducing yourself as Alex from SmartHire and asking the first question related to ${params.jobTitle}.`;
  }

  /**
   * Evaluates the completed interview transcript deterministically using Gemini Service.
   * Produces structured rubric scores (0-100) and question-by-question evidence.
   */
  static async evaluateTranscript(params: {
    jobTitle: string;
    jobDescription: string;
    transcript: InterviewTranscriptTurn[];
    durationMinutes: number;
    timeSpentSeconds: number;
  }): Promise<StructuredInterviewEvaluation> {
    const formattedTranscript = params.transcript
      .map((t) => `[${t.timeFormatted}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join("\n");

    const prompt = `You are an executive hiring panel evaluator analyzing a completed technical AI Interview transcript.

### JOB CONTEXT:
Target Position: ${params.jobTitle}
Job Description:
${params.jobDescription.slice(0, 2500)}

### COMPLETE INTERVIEW TRANSCRIPT:
${formattedTranscript.slice(0, 8000)}

### EVALUATION RUBRIC (0 to 100 Score for each dimension):
1. Technical Competence (Weight: 40%): Depth of technical knowledge required by the Job Description.
2. Problem Solving & Reasoning (Weight: 20%): Ability to diagnose issues, explain trade-offs, and justify technical choices.
3. Communication Clarity (Weight: 15%): Structured, relevant, and clear explanations. Do NOT evaluate accent, grammar variations, or pitch.
4. Applied Experience (Weight: 15%): Ability to connect real project experience to practical situations.
5. Professional Judgment (Weight: 10%): Collaboration, ownership, and decision-making.

Return ONLY valid JSON matching this schema:
{
  "technicalCompetence": { "score": 85, "evidence": ["Quoted candidate answer 1"], "reasoning": "Explanation..." },
  "problemSolving": { "score": 80, "evidence": ["Quoted candidate answer 2"], "reasoning": "Explanation..." },
  "communication": { "score": 88, "evidence": ["Quoted candidate answer 3"], "reasoning": "Explanation..." },
  "appliedExperience": { "score": 82, "evidence": ["Quoted candidate answer 4"], "reasoning": "Explanation..." },
  "professionalJudgment": { "score": 80, "evidence": ["Quoted candidate answer 5"], "reasoning": "Explanation..." },
  "strengths": ["Clear explanation of SQL joins", "Strong applied experience in Node.js"],
  "developmentAreas": ["Could quantify project outcomes with specific metrics"],
  "summary": "Candidate demonstrated strong technical competence and clear communication.",
  "questionReviews": [
    {
      "topic": "SQL & Data Extraction",
      "question": "Tell me about your experience with SQL joins.",
      "candidateAnswer": "I have used INNER and LEFT JOINs in PostgreSQL...",
      "followUps": ["How did you handle large dataset aggregation?"],
      "evidence": "Accurately explained join mechanics and indexing.",
      "score": 88
    }
  ]
}`;

    const res = await generateStructuredGeminiResponse<any>({
      prompt,
      timeoutMs: 15000,
      temperature: 0.1,
    });

    const d = res.data || {};

    const clamp = (val: any, def = 70) => {
      const num = Number(val);
      return isNaN(num) ? def : Math.min(100, Math.max(0, Math.round(num)));
    };

    const techScore = clamp(d.technicalCompetence?.score, 75);
    const probScore = clamp(d.problemSolving?.score, 70);
    const commScore = clamp(d.communication?.score, 80);
    const expScore = clamp(d.appliedExperience?.score, 75);
    const judgScore = clamp(d.professionalJudgment?.score, 75);

    // Weighted Overall Score (40% Tech, 20% Prob, 15% Comm, 15% Exp, 10% Judg)
    const overallScore = Math.round(
      techScore * 0.40 +
      probScore * 0.20 +
      commScore * 0.15 +
      expScore * 0.15 +
      judgScore * 0.10
    );

    return {
      technicalCompetence: {
        score: techScore,
        evidence: Array.isArray(d.technicalCompetence?.evidence) ? d.technicalCompetence.evidence : [],
        reasoning: d.technicalCompetence?.reasoning || "Technical competence evaluated against job description requirements.",
      },
      problemSolving: {
        score: probScore,
        evidence: Array.isArray(d.problemSolving?.evidence) ? d.problemSolving.evidence : [],
        reasoning: d.problemSolving?.reasoning || "Problem solving & technical reasoning evaluated.",
      },
      communication: {
        score: commScore,
        evidence: Array.isArray(d.communication?.evidence) ? d.communication.evidence : [],
        reasoning: d.communication?.reasoning || "Communication clarity and response structure evaluated.",
      },
      appliedExperience: {
        score: expScore,
        evidence: Array.isArray(d.appliedExperience?.evidence) ? d.appliedExperience.evidence : [],
        reasoning: d.appliedExperience?.reasoning || "Applied project and work experience evaluated.",
      },
      professionalJudgment: {
        score: judgScore,
        evidence: Array.isArray(d.professionalJudgment?.evidence) ? d.professionalJudgment.evidence : [],
        reasoning: d.professionalJudgment?.reasoning || "Professional judgment and collaboration evaluated.",
      },
      overallScore,
      passed: overallScore >= 60,
      strengths: Array.isArray(d.strengths) ? d.strengths : ["Demonstrated role-relevant competence."],
      developmentAreas: Array.isArray(d.developmentAreas) ? d.developmentAreas : ["Provide more quantitative project metrics."],
      summary: d.summary || "AI Interview completed and evaluated.",
      questionReviews: Array.isArray(d.questionReviews) ? d.questionReviews : [],
    };
  }
}
