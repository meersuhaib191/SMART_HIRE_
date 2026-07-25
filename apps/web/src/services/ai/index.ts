/**
 * AI Service — Public Module Index
 *
 * Re-exports all public types, interfaces, and the AIService facade.
 * Import from this barrel to access any AI Service capability.
 *
 * @example
 *   import { AIService, AIProviderRegistry, NullAIProvider } from "@/services/ai";
 */

// Facade
export { AIService } from "./ai-service";

// Provider infrastructure
export { AIProviderRegistry } from "./providers/ai-provider-registry";
export { NullAIProvider } from "./providers/null-provider";

// Master provider interface
export type { IAIProvider, AIProviderStatus } from "./interfaces/ai-provider.interface";

// Sub-capability interfaces
export type { IResumeParser, ResumeParserInput, ParsedResume, ParsedExperience, ParsedEducation } from "./interfaces/resume-parser.interface";
export type { IResumeScorer, ResumeScorerInput, ResumeScore, ResumeScoreBreakdown } from "./interfaces/resume-scorer.interface";
export type { ISkillExtractor, SkillExtractorInput, ExtractedSkill, SkillCategory, SkillProficiency } from "./interfaces/skill-extractor.interface";
export type { ICandidateRanker, CandidateRankerInput, CandidateRankingEntry, CandidateProfile } from "./interfaces/candidate-ranker.interface";
export type { IJobMatcher, JobMatcherInput, JobMatch, JobPosting } from "./interfaces/job-matcher.interface";
export type { IQuestionGenerator, QuestionGeneratorInput, GeneratedQuestion, QuestionCategory, QuestionDifficulty } from "./interfaces/question-generator.interface";

// Central Gemini AI Service
export { generateStructuredGeminiResponse, getGeminiHealth } from "./gemini-service";
export { generateGeminiAtsSuggestions } from "./gemini-ats-suggester";
export { evaluateCodeWithGemini } from "./gemini-evaluator";
