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



export type AnswerQuality = "meaningful" | "partial" | "irrelevant" | "no_response" | "candidate_requested_repeat";

export function classifyAnswerQuality(text?: string | null): AnswerQuality {
  if (!text || typeof text !== "string") return "no_response";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "no_response";

  const lower = trimmed.toLowerCase();
  const noRespMarkers = [
    "no verbal response provided",
    "(no verbal response provided)",
    "no response",
    "no answer",
    "silence",
    "none",
    "null",
  ];
  if (noRespMarkers.some((m) => lower === m || lower.includes("no verbal response"))) {
    return "no_response";
  }

  const repeatMarkers = ["repeat", "can you repeat", "could you repeat", "pardon", "say that again"];
  if (repeatMarkers.some((m) => lower.includes(m))) {
    return "candidate_requested_repeat";
  }

  const fillers = ["thank you", "thanks", "yes", "yeah", "okay", "ok", "hmmm", "hmm", "i don't know", "idk", "thank you i was working in"];
  if (fillers.includes(lower) || trimmed.length < 15) {
    return "partial";
  }

  if (trimmed.length < 35) {
    return "partial";
  }

  return "meaningful";
}

export interface TurnProcessInput {
  jobTitle: string;
  jobDescription: string;
  candidateName: string;
  candidateResumeText?: string;
  focusTopics?: string;
  durationMinutes: number;
  remainingMinutes: number;
  currentQuestion: string;
  candidateAnswer: string;
  recentTranscriptSummary?: string;
  questionNumber: number;
  askedQuestionTexts?: string[];
  consecutiveNoResponses?: number;
}

export interface TurnProcessResult {
  answerQuality: AnswerQuality;
  answerEvidence: {
    competency: string;
    summary: string;
    evidenceStrength: "strong" | "moderate" | "insufficient" | "no_response";
  };
  nextAction: "question" | "conclude";
  nextQuestion?: {
    text: string;
    competency: string;
    isFollowUp: boolean;
  };
}

export class LiveInterviewService {
  /**
   * Generates ONLY the opening Question 1 dynamically via server-side Gemini REST call.
   */
  static async generateOpeningQuestion(params: {
    jobTitle: string;
    jobDescription: string;
    candidateName: string;
    candidateResumeText?: string;
    focusTopics?: string;
    durationMinutes: number;
  }): Promise<{ questionText: string; competency: string }> {
    const focus = params.focusTopics ? `\nRECRUITER FOCUS TOPICS:\n${params.focusTopics}` : "";
    const resume = params.candidateResumeText ? `\nCANDIDATE RESUME HIGHLIGHTS:\n${params.candidateResumeText.slice(0, 1500)}` : "";

    const prompt = `You are Alex, an expert Senior AI Technical Interviewer for SmartHire.
Generate ONLY the FIRST opening question to start a ${params.durationMinutes}-minute professional interview for ${params.candidateName} applying for ${params.jobTitle}.

### JOB DESCRIPTION:
${params.jobDescription.slice(0, 2000)}
${focus}
${resume}

INSTRUCTIONS:
1. Greet ${params.candidateName} warmly in 1 short sentence as Alex from SmartHire.
2. Ask ONE clear, engaging role-relevant question (either about their relevant background project or a core technical/conceptual skill required by the JD).
3. Do NOT ask multiple questions at once.

Return valid JSON strictly matching:
{
  "questionText": "Hello ${params.candidateName}! Welcome to your interview for ${params.jobTitle}. To start us off, tell me...",
  "competency": "role_knowledge"
}`;

    try {
      const res = await generateStructuredGeminiResponse<{ questionText: string; competency: string }>({
        prompt,
        timeoutMs: 10000,
        temperature: 0.3,
      });

      if (res.success && res.data?.questionText) {
        return {
          questionText: res.data.questionText,
          competency: res.data.competency || "role_knowledge",
        };
      }
    } catch (err) {
      logger.warn("[LiveInterviewService] Opening question LLM generation warning", err);
    }

    return {
      questionText: `Hello ${params.candidateName}! Welcome to your AI Technical Interview for the ${params.jobTitle} position. To start us off, could you briefly walk me through your background and the technical projects most relevant to this role?`,
      competency: "role_knowledge",
    };
  }

  /**
   * Processes a single candidate answer turn using ONE server-side REST Gemini request.
   * Handles no-response / silence deterministically without praise.
   * Prevents duplicate questions.
   */
  static async processInterviewTurn(input: TurnProcessInput): Promise<TurnProcessResult> {
    const quality = classifyAnswerQuality(input.candidateAnswer);
    const askedTexts = input.askedQuestionTexts || [];

    // Early conclusion if remaining time low, max questions reached, or 3 consecutive no-responses
    if (input.remainingMinutes <= 1 || input.questionNumber >= 10 || (input.consecutiveNoResponses || 0) >= 2) {
      return {
        answerQuality: quality,
        answerEvidence: {
          competency: "general",
          summary: quality === "no_response" ? "No candidate response provided." : "Candidate provided final response.",
          evidenceStrength: quality === "no_response" ? "no_response" : "moderate",
        },
        nextAction: "conclude",
      };
    }

    // Deterministic fast-path for silence / no-response (saves Gemini latency & cost, uses neutral transition)
    if (quality === "no_response") {
      const fallbackQuestions = [
        `I didn't receive a response. Let's move to our next area: in your software engineering work, how do you approach diagnosing complex bugs in production?`,
        `I didn't hear an answer, so let's continue. Can you describe a key technical project you led and the architecture choices you made?`,
        `No response recorded. Let's move forward: how do you evaluate technical trade-offs between speed of delivery and system scalability?`,
      ];

      // Pick a non-duplicate question
      let nextQ = fallbackQuestions[input.questionNumber % fallbackQuestions.length];
      const prevNormalized = askedTexts.map((t) => t.toLowerCase().trim());
      if (prevNormalized.includes(nextQ.toLowerCase().trim())) {
        nextQ = `I didn't receive a response. Let's move forward: how do you collaborate with your engineering team when technical opinions differ on a release?`;
      }

      return {
        answerQuality: "no_response",
        answerEvidence: {
          competency: "general",
          summary: "No response provided by candidate.",
          evidenceStrength: "no_response",
        },
        nextAction: "question",
        nextQuestion: {
          text: nextQ,
          competency: "problem_solving",
          isFollowUp: false,
        },
      };
    }

    const focus = input.focusTopics ? `\nRECRUITER FOCUS TOPICS:\n${input.focusTopics}` : "";
    const resume = input.candidateResumeText ? `\nCANDIDATE RESUME:\n${input.candidateResumeText.slice(0, 1000)}` : "";
    const askedListStr = askedTexts.length > 0 ? `\nPREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT ANY OF THESE):\n${askedTexts.map((q, i) => `${i + 1}. "${q}"`).join("\n")}` : "";

    const prompt = `You are Alex, an expert AI Technical Interviewer conducting a turn-based interview for ${input.jobTitle}.

### JOB CONTEXT:
${input.jobDescription.slice(0, 1800)}
${focus}
${resume}

### INTERVIEW STATE:
- Current Question #${input.questionNumber}: "${input.currentQuestion}"
- Candidate Answer: "${input.candidateAnswer.slice(0, 2000)}"
- Answer Quality: ${quality}
- Remaining Time: ${input.remainingMinutes} minutes remaining out of ${input.durationMinutes} minutes total.
${askedListStr}

INSTRUCTIONS:
1. Analyze candidate's answer for evidence strength (strong | moderate | insufficient | no_response).
2. Generate ONE next adaptive question. Do NOT repeat any previously asked question.
3. If candidate's answer was partial, ask a single relevant follow-up. If meaningful, transition with a brief "Thank you" and move to the next competency.

Return valid JSON strictly matching:
{
  "answerEvidence": {
    "competency": "technical",
    "summary": "Candidate explained...",
    "evidenceStrength": "${quality === "meaningful" ? "strong" : "moderate"}"
  },
  "nextAction": "question",
  "nextQuestion": {
    "text": "Thank you. Moving to system architecture: how would you handle...",
    "competency": "problem_solving",
    "isFollowUp": false
  }
}`;

    try {
      const res = await generateStructuredGeminiResponse<TurnProcessResult>({
        prompt,
        timeoutMs: 12000,
        temperature: 0.2,
      });

      if (res.success && res.data?.nextQuestion?.text) {
        // Validate question is not a duplicate
        const newText = res.data.nextQuestion.text.trim();
        const isDuplicate = askedTexts.some((prev) => prev.toLowerCase().trim() === newText.toLowerCase());

        if (!isDuplicate) {
          return {
            answerQuality: quality,
            answerEvidence: res.data.answerEvidence || {
              competency: "technical",
              summary: "Candidate responded.",
              evidenceStrength: "moderate",
            },
            nextAction: res.data.nextAction || "question",
            nextQuestion: res.data.nextQuestion,
          };
        }
      }
    } catch (err) {
      logger.warn("[LiveInterviewService] Process turn LLM warning", err);
    }

    // Non-duplicate fallback question
    const defaultCompetencies = ["technical_competence", "problem_solving", "applied_experience", "professional_judgment"];
    const nextComp = defaultCompetencies[input.questionNumber % defaultCompetencies.length];

    return {
      answerQuality: quality,
      answerEvidence: {
        competency: nextComp,
        summary: "Candidate provided response.",
        evidenceStrength: "moderate",
      },
      nextAction: "question",
      nextQuestion: {
        text: `Thank you for sharing that. Let's move to our next area: in your production experience for ${input.jobTitle}, how do you approach testing and validating complex changes before deployment?`,
        competency: nextComp,
        isFollowUp: false,
      },
    };
  }

  /**
   * Evaluates the completed interview transcript strictly based on demonstrated evidence.
   * ABSOLUTELY NO FAKE / FALLBACK 75% SCORES. NO EVIDENCE = NO CREDIT (0%).
   */
  static async evaluateTranscript(params: {
    jobTitle: string;
    jobDescription: string;
    transcript: InterviewTranscriptTurn[];
    durationMinutes: number;
    timeSpentSeconds: number;
  }): Promise<StructuredInterviewEvaluation> {
    const rawTurns = params.transcript || [];
    const formattedTranscript = rawTurns
      .map((t) => `[${t.timeFormatted}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join("\n");

    // Count answer qualities across candidate turns
    const candidateTurns = rawTurns.filter((t) => t.speaker === "candidate");
    const totalQuestionsAsked = rawTurns.filter((t) => t.speaker === "interviewer").length;

    let meaningfulCount = 0;
    let partialCount = 0;
    let noResponseCount = 0;

    const questionReviews: Array<{
      topic: string;
      question: string;
      candidateAnswer: string;
      answerQuality: AnswerQuality;
      followUps: string[];
      evidence: string;
      score: number;
    }> = [];

    // Analyze each turn pair
    for (let i = 0; i < rawTurns.length; i++) {
      if (rawTurns[i].speaker === "interviewer") {
        const qText = rawTurns[i].text;
        const nextTurn = rawTurns[i + 1];
        const candidateText = (nextTurn && nextTurn.speaker === "candidate") ? nextTurn.text : null;
        const qQuality = classifyAnswerQuality(candidateText);

        if (qQuality === "meaningful") meaningfulCount++;
        else if (qQuality === "partial") partialCount++;
        else if (qQuality === "no_response") noResponseCount++;

        const turnScore = qQuality === "meaningful" ? 80 : qQuality === "partial" ? 30 : 0;
        const turnEv = qQuality === "no_response"
          ? "No response provided by candidate."
          : qQuality === "partial"
          ? "Candidate provided partial/incomplete answer without detailed reasoning."
          : "Candidate provided substantive answer.";

        questionReviews.push({
          topic: `Question ${questionReviews.length + 1}`,
          question: qText,
          candidateAnswer: candidateText || "(No verbal response provided)",
          answerQuality: qQuality,
          followUps: [],
          evidence: turnEv,
          score: turnScore,
        });
      }
    }

    // STRICT MINIMUM EVIDENCE CHECK: If candidate provided almost no substantive answers
    const hasInsufficientEvidence = meaningfulCount === 0 && partialCount <= 1;

    if (hasInsufficientEvidence) {
      logger.info(`[LiveInterviewService] Insufficient evidence detected (Meaningful: ${meaningfulCount}, Partial: ${partialCount}, NoResponse: ${noResponseCount}). Returning strict 0% result.`);

      return {
        technicalCompetence: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "No assessable technical response provided." },
        problemSolving: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "No response provided for problem-solving questions." },
        communication: { score: partialCount > 0 ? 10 : 0, evidenceStatus: partialCount > 0 ? "limited_evidence" : "insufficient_evidence", evidence: partialCount > 0 ? ["Candidate spoke brief introductory phrase but did not complete technical answers."] : [], reasoning: "Insufficient sustained response to evaluate communication clarity." },
        appliedExperience: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "No candidate project or work experience demonstrated." },
        professionalJudgment: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "No response provided for professional judgment questions." },
        overallScore: partialCount > 0 ? 2 : 0,
        passed: false,
        evaluationStatus: "insufficient_evidence",
        meaningfulAnswersCount: meaningfulCount,
        partialAnswersCount: partialCount,
        unansweredCount: noResponseCount,
        totalQuestionsAsked,
        strengths: [],
        developmentAreas: [
          "Provide complete, substantive responses to interview questions so technical and problem-solving competencies can be evaluated.",
          "Elaborate on production experience and technical trade-offs.",
        ],
        summary: "Insufficient interview evidence was provided by the candidate to evaluate role competencies.",
        questionReviews,
      };
    }

    // Execute Gemini evidence-based evaluation call
    const prompt = `You are an executive hiring panel evaluator analyzing a completed technical AI Interview transcript.

CRITICAL MANDATORY EVALUATION RULES:
1. NO EVIDENCE = NO CREDIT. Evaluate ONLY demonstrated evidence explicitly present in candidate answers.
2. Do NOT infer skills from job title, resume, expectations, or assumptions.
3. No response provides 0 credit.
4. Do NOT manufacture default or fake 70-80% scores when evidence is weak or missing.
5. Do NOT output generic positive filler strengths like "Demonstrated role-relevant competence". If candidate showed no strengths, return an empty array [].
6. Output 0 for any competency where the candidate provided no assessable evidence.

### JOB CONTEXT:
Target Position: ${params.jobTitle}
Job Description:
${params.jobDescription.slice(0, 2000)}

### COMPLETE INTERVIEW TRANSCRIPT:
${formattedTranscript.slice(0, 8000)}

Return ONLY valid JSON strictly matching:
{
  "technicalCompetence": { "score": 0, "evidenceStatus": "insufficient_evidence", "evidence": [], "reasoning": "Explanation..." },
  "problemSolving": { "score": 0, "evidenceStatus": "insufficient_evidence", "evidence": [], "reasoning": "Explanation..." },
  "communication": { "score": 0, "evidenceStatus": "insufficient_evidence", "evidence": [], "reasoning": "Explanation..." },
  "appliedExperience": { "score": 0, "evidenceStatus": "insufficient_evidence", "evidence": [], "reasoning": "Explanation..." },
  "professionalJudgment": { "score": 0, "evidenceStatus": "insufficient_evidence", "evidence": [], "reasoning": "Explanation..." },
  "strengths": [],
  "developmentAreas": ["Specific growth area based on observed response gaps"],
  "summary": "Evidence-backed evaluation summary..."
}`;

    try {
      const res = await generateStructuredGeminiResponse<any>({
        prompt,
        timeoutMs: 15000,
        temperature: 0.1,
      });

      const d = res.data || {};

      // STRICT SCORE CLAMP WITH DEFAULT 0 (NEVER 75/70/80!)
      const clampScore = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
      };

      const techScore = clampScore(d.technicalCompetence?.score);
      const probScore = clampScore(d.problemSolving?.score);
      const commScore = clampScore(d.communication?.score);
      const expScore = clampScore(d.appliedExperience?.score);
      const judgScore = clampScore(d.professionalJudgment?.score);

      // SmartHire Server-Calculated Weighted Score (40% Tech, 20% Prob, 15% Comm, 15% Exp, 10% Judg)
      const overallScore = Math.round(
        techScore * 0.40 +
        probScore * 0.20 +
        commScore * 0.15 +
        expScore * 0.15 +
        judgScore * 0.10
      );

      const passed = overallScore >= 60 && meaningfulCount >= Math.ceil(totalQuestionsAsked * 0.5);

      const getEvStatus = (sc: number, rawEv: string): "sufficient_evidence" | "limited_evidence" | "insufficient_evidence" => {
        if (rawEv === "sufficient_evidence" || rawEv === "limited_evidence" || rawEv === "insufficient_evidence") {
          return rawEv;
        }
        return sc >= 60 ? "sufficient_evidence" : sc >= 20 ? "limited_evidence" : "insufficient_evidence";
      };

      const cleanStrengths = Array.isArray(d.strengths)
        ? d.strengths.filter((s: string) => s && !s.toLowerCase().includes("role-relevant competence") && !s.toLowerCase().includes("demonstrated role"))
        : [];

      return {
        technicalCompetence: {
          score: techScore,
          evidenceStatus: getEvStatus(techScore, d.technicalCompetence?.evidenceStatus),
          evidence: Array.isArray(d.technicalCompetence?.evidence) ? d.technicalCompetence.evidence : [],
          reasoning: d.technicalCompetence?.reasoning || "Technical competence evaluated strictly from demonstrated answer evidence.",
        },
        problemSolving: {
          score: probScore,
          evidenceStatus: getEvStatus(probScore, d.problemSolving?.evidenceStatus),
          evidence: Array.isArray(d.problemSolving?.evidence) ? d.problemSolving.evidence : [],
          reasoning: d.problemSolving?.reasoning || "Problem solving evaluated strictly from demonstrated answer evidence.",
        },
        communication: {
          score: commScore,
          evidenceStatus: getEvStatus(commScore, d.communication?.evidenceStatus),
          evidence: Array.isArray(d.communication?.evidence) ? d.communication.evidence : [],
          reasoning: d.communication?.reasoning || "Communication clarity evaluated from transcript response structure.",
        },
        appliedExperience: {
          score: expScore,
          evidenceStatus: getEvStatus(expScore, d.appliedExperience?.evidenceStatus),
          evidence: Array.isArray(d.appliedExperience?.evidence) ? d.appliedExperience.evidence : [],
          reasoning: d.appliedExperience?.reasoning || "Applied experience evaluated from demonstrated candidate project examples.",
        },
        professionalJudgment: {
          score: judgScore,
          evidenceStatus: getEvStatus(judgScore, d.professionalJudgment?.evidenceStatus),
          evidence: Array.isArray(d.professionalJudgment?.evidence) ? d.professionalJudgment.evidence : [],
          reasoning: d.professionalJudgment?.reasoning || "Professional judgment evaluated from scenario responses.",
        },
        overallScore,
        passed,
        evaluationStatus: "completed",
        meaningfulAnswersCount: meaningfulCount,
        partialAnswersCount: partialCount,
        unansweredCount: noResponseCount,
        totalQuestionsAsked,
        strengths: cleanStrengths,
        developmentAreas: Array.isArray(d.developmentAreas) ? d.developmentAreas : ["Provide more quantitative project metrics and detailed code reasoning."],
        summary: d.summary || "AI Interview evidence evaluation completed.",
        questionReviews,
      };
    } catch (err) {
      logger.error("[LiveInterviewService] Evaluation error", err);
      // DO NOT RETURN 75% PASSED ON ERROR! Return failed evaluation status.
      return {
        technicalCompetence: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "Evaluation processing failed." },
        problemSolving: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "Evaluation processing failed." },
        communication: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "Evaluation processing failed." },
        appliedExperience: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "Evaluation processing failed." },
        professionalJudgment: { score: 0, evidenceStatus: "insufficient_evidence", evidence: [], reasoning: "Evaluation processing failed." },
        overallScore: 0,
        passed: false,
        evaluationStatus: "failed",
        meaningfulAnswersCount: meaningfulCount,
        partialAnswersCount: partialCount,
        unansweredCount: noResponseCount,
        totalQuestionsAsked,
        strengths: [],
        developmentAreas: ["Interview evaluation temporarily failed and will be retried."],
        summary: "Evaluation processing encountered an error and requires retry.",
        questionReviews,
      };
    }
  }
}
