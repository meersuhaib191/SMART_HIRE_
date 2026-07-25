import { NextResponse } from "next/server";
import { AIService, getGeminiHealth } from "@/services/ai";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

/** GET /api/ai/health — Returns the health status of the active AI provider and Gemini connectivity */
export async function GET() {
  try {
    logger.info("[API] GET /api/ai/health");
    const [status, geminiHealth] = await Promise.all([
      AIService.healthCheck().catch((err) => ({ error: String(err) })),
      getGeminiHealth().catch((err) => ({ configured: false, operational: false, notice: String(err) })),
    ]);

    return NextResponse.json({
      data: status,
      gemini: geminiHealth,
    });
  } catch (err: unknown) {
    logger.error("[API] AI health check error", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Health check failed", message }, { status: 500 });
  }
}
