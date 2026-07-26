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

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

function getModelHierarchy(): string[] {
  const customModel = process.env.GEMINI_TEXT_MODEL?.trim();
  if (customModel) {
    return [customModel, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== customModel)];
  }
  return DEFAULT_GEMINI_MODELS;
}

function getApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_KEY;

  return key && key.trim().length > 0 ? key.trim() : null;
}

/**
 * Safely extracts and parses JSON content from LLM response text,
 * handling markdown code fences and extraneous pre/post text.
 */
function extractAndParseJson<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (initialErr) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonSub) as T;
    }

    throw new Error(
      `JSON parsing failed: ${initialErr instanceof Error ? initialErr.message : "Malformed JSON"}`
    );
  }
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
    logger.warn("[GeminiService] GEMINI_API_KEY is not configured server-side. Key configured: false");
    return {
      success: false,
      errorCategory: "GEMINI_KEY_MISSING",
      errorMessage: "Gemini API key is not configured in server environment (GEMINI_API_KEY).",
    };
  }

  const modelsToTry = getModelHierarchy();
  const timeoutMs = params.timeoutMs || 5000;
  let lastErrorCategory: GeminiErrorCategory = "GEMINI_UNKNOWN_ERROR";
  let lastErrorMessage = "Failed to communicate with Gemini API.";

  // Iterate over candidate models
  for (const modelName of modelsToTry) {
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
        logger.error(
          `[GeminiService] Model ${modelName} HTTP ${response.status}: ${errorText.slice(0, 150)}`
        );

        if (response.status === 401 || response.status === 403) {
          lastErrorCategory = "GEMINI_AUTH_FAILED";
          lastErrorMessage = `Gemini API key authentication/authorization failed (HTTP ${response.status}).`;
          break; // Don't retry invalid auth key
        } else if (response.status === 429) {
          lastErrorCategory = "GEMINI_RATE_LIMITED";
          lastErrorMessage = "Gemini API rate limit or quota exceeded (HTTP 429).";
          break; // Don't retry quota exceeded
        } else if (response.status === 404) {
          lastErrorCategory = "GEMINI_MODEL_ERROR";
          lastErrorMessage = `Model ${modelName} not found (HTTP 404).`;
          continue; // Try next model if 404
        } else {
          lastErrorCategory = "GEMINI_UNKNOWN_ERROR";
          lastErrorMessage = `HTTP ${response.status} error from Gemini provider.`;
          continue;
        }
      }

      const resData = await response.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
        lastErrorCategory = "GEMINI_INVALID_RESPONSE";
        lastErrorMessage = "Gemini API returned an empty response candidate.";
        continue;
      }

      const parsedData = extractAndParseJson<T>(rawText);
      const latencyMs = Date.now() - startTime;
      logger.info(`[GeminiService] Successfully generated response using model=${modelName} in ${latencyMs}ms`);

      return {
        success: true,
        data: parsedData,
        modelUsed: modelName,
        latencyMs,
      };
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.warn(`[GeminiService] Model ${modelName} timed out after ${timeoutMs}ms.`);
        lastErrorCategory = "GEMINI_TIMEOUT";
        lastErrorMessage = `Gemini API request timed out after ${timeoutMs}ms.`;
      } else {
        logger.error(`[GeminiService] Model ${modelName} parsing/execution error: ${err.message || String(err)}`);
        lastErrorCategory = "GEMINI_INVALID_RESPONSE";
        lastErrorMessage = err instanceof Error ? err.message : "Failed to parse Gemini response payload.";
      }
    }
  }

  const totalLatencyMs = Date.now() - startTime;
  logger.warn(
    `[GeminiService] All models failed. Error Category: ${lastErrorCategory}, Message: ${lastErrorMessage}, Total Latency: ${totalLatencyMs}ms`
  );

  return {
    success: false,
    errorCategory: lastErrorCategory,
    errorMessage: lastErrorMessage,
    latencyMs: totalLatencyMs,
  };
}

/**
 * Health Check helper for Gemini integration (Never exposes secret key)
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
      notice: "GEMINI_API_KEY environment variable is not configured server-side.",
    };
  }

  const result = await generateStructuredGeminiResponse<{ status: string }>({
    prompt: `Respond ONLY with valid JSON: {"status": "ok"}`,
    timeoutMs: 5000,
  });

  return {
    configured: true,
    operational: result.success,
    model: result.modelUsed,
    notice: result.success ? "Gemini AI is fully operational." : result.errorMessage,
  };
}
