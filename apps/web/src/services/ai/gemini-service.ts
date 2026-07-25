import { logger } from "@smarthire/logger";

export type GeminiErrorCategory =
  | "GEMINI_KEY_MISSING"
  | "GEMINI_AUTH_FAILED"
  | "GEMINI_RATE_LIMITED"
  | "GEMINI_TIMEOUT"
  | "GEMINI_MODEL_ERROR"
  | "GEMINI_INVALID_RESPONSE"
  | "GEMINI_UNKNOWN_ERROR";

export interface GeminiServiceResponse<T> {
  success: boolean;
  data?: T;
  errorCategory?: GeminiErrorCategory;
  errorMessage?: string;
  modelUsed?: string;
  latencyMs?: number;
}

/**
 * Supported models hierarchy in order of preference
 */
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-flash-latest",
];

function getApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_KEY;

  return key && key.trim().length > 0 ? key.trim() : null;
}

/**
 * Centralized Structured Gemini API call with model fallback and error classification
 */
export async function generateStructuredGeminiResponse<T>(params: {
  prompt: string;
  timeoutMs?: number;
  temperature?: number;
}): Promise<GeminiServiceResponse<T>> {
  const startTime = Date.now();
  const apiKey = getApiKey();

  if (!apiKey) {
    logger.warn("[GeminiService] GEMINI_API_KEY is not configured server-side.");
    return {
      success: false,
      errorCategory: "GEMINI_KEY_MISSING",
      errorMessage: "Gemini API key not configured in environment.",
    };
  }

  const timeoutMs = params.timeoutMs || 12000;
  let lastErrorCategory: GeminiErrorCategory = "GEMINI_UNKNOWN_ERROR";
  let lastErrorMessage = "Failed to communicate with Gemini API.";

  // Iterate over candidate models
  for (const modelName of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: params.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: params.temperature ?? 0.2,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error(`[GeminiService] Model ${modelName} returned HTTP ${response.status}: ${errorText.slice(0, 200)}`);

        if (response.status === 401 || response.status === 403) {
          lastErrorCategory = "GEMINI_AUTH_FAILED";
          lastErrorMessage = `API Key authentication failed (HTTP ${response.status}).`;
          break; // Don't retry invalid auth key
        } else if (response.status === 429) {
          lastErrorCategory = "GEMINI_RATE_LIMITED";
          lastErrorMessage = "Gemini API rate limit or quota exceeded.";
          continue; // Try fallback model
        } else if (response.status === 404) {
          lastErrorCategory = "GEMINI_MODEL_ERROR";
          lastErrorMessage = `Model ${modelName} not available.`;
          continue; // Try fallback model
        } else {
          lastErrorCategory = "GEMINI_UNKNOWN_ERROR";
          lastErrorMessage = `HTTP ${response.status} error from Gemini API.`;
          continue;
        }
      }

      const resData = await response.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        lastErrorCategory = "GEMINI_INVALID_RESPONSE";
        lastErrorMessage = "Gemini response contained no text content.";
        continue;
      }

      const cleanedText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsedData: T = JSON.parse(cleanedText);

      return {
        success: true,
        data: parsedData,
        modelUsed: modelName,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.warn(`[GeminiService] Model ${modelName} timed out after ${timeoutMs}ms.`);
        lastErrorCategory = "GEMINI_TIMEOUT";
        lastErrorMessage = `Gemini API request timed out after ${timeoutMs}ms.`;
      } else {
        logger.error(`[GeminiService] Error calling model ${modelName}:`, err);
        lastErrorCategory = "GEMINI_INVALID_RESPONSE";
        lastErrorMessage = err instanceof Error ? err.message : "Failed to parse Gemini response.";
      }
    }
  }

  return {
    success: false,
    errorCategory: lastErrorCategory,
    errorMessage: lastErrorMessage,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Health Check helper for Gemini integration (Never exposes key)
 */
export async function getGeminiHealth(): Promise<{
  configured: boolean;
  operational: boolean;
  model?: string;
  notice?: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      configured: false,
      operational: false,
      notice: "GEMINI_API_KEY is not configured.",
    };
  }

  const result = await generateStructuredGeminiResponse<{ status: string }>({
    prompt: `Respond with JSON: {"status": "ok"}`,
    timeoutMs: 5000,
  });

  return {
    configured: true,
    operational: result.success,
    model: result.modelUsed,
    notice: result.success ? "Gemini AI is operational." : result.errorMessage,
  };
}
