import { NextRequest, NextResponse } from "next/server";
import { ATSEngine } from "@/services/ats/ats-engine";
import { extractTextFromAnyFileBuffer } from "@/utils/document-text-extractor";
import { generateGeminiAtsSuggestions } from "@/services/ai/gemini-ats-suggester";
import { logger } from "@smarthire/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info("[ATS Stage] ATS_REQUEST_RECEIVED");

  try {
    const contentType = request.headers.get("content-type") || "";
    let resumeTextInput = "";
    let jdTextInput = "";
    let resumeFile: File | null = null;
    let jdFile: File | null = null;
    let jobTitleInput = "Target Position";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      resumeFile = formData.get("resumeFile") as File | null;
      resumeTextInput = (formData.get("resumeText") as string) || "";
      jdFile = formData.get("jdFile") as File | null;
      jdTextInput = (formData.get("jdText") as string) || "";
      jobTitleInput = (formData.get("jobTitle") as string) || "Target Position";
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      resumeTextInput = body.resumeText || "";
      jdTextInput = body.jdText || "";
      jobTitleInput = body.jobTitle || "Target Position";
    }

    // 1. File Size Validation
    if (resumeFile && resumeFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", message: "Uploaded Resume file exceeds the maximum 10MB size limit." },
        { status: 413 }
      );
    }
    if (jdFile && jdFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", message: "Uploaded Job Description file exceeds the maximum 10MB size limit." },
        { status: 413 }
      );
    }

    let finalResumeText = resumeTextInput.trim();
    let finalJdText = jdTextInput.trim();

    // 2. Extract Resume Text
    if (resumeFile && resumeFile.size > 0) {
      try {
        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        const extracted = await extractTextFromAnyFileBuffer(buffer, resumeFile.name);
        if (extracted && extracted.trim().length > 0) {
          finalResumeText = extracted;
        }
      } catch (err) {
        logger.error("[ATS Stage] Resume text extraction failed", err);
      }
    }
    logger.info(`[ATS Stage] RESUME_EXTRACTED (length: ${finalResumeText.length} chars)`);

    // 3. Extract JD Text
    if (jdFile && jdFile.size > 0) {
      try {
        const buffer = Buffer.from(await jdFile.arrayBuffer());
        const extracted = await extractTextFromAnyFileBuffer(buffer, jdFile.name);
        if (extracted && extracted.trim().length > 0) {
          finalJdText = extracted;
        }
      } catch (err) {
        logger.error("[ATS Stage] JD text extraction failed", err);
      }
    }
    logger.info(`[ATS Stage] JD_EXTRACTED (length: ${finalJdText.length} chars)`);

    // 4. Input Validation
    if (!finalResumeText || finalResumeText.length < 5) {
      return NextResponse.json(
        {
          error: "MISSING_RESUME",
          message: "Resume content is empty or unreadable. Please upload a valid PDF/DOCX document or paste raw text.",
        },
        { status: 400 }
      );
    }

    if (!finalJdText || finalJdText.length < 5) {
      return NextResponse.json(
        {
          error: "MISSING_JD",
          message: "Job Description content is empty or unreadable. Please upload a valid PDF/DOCX document or paste raw text.",
        },
        { status: 400 }
      );
    }

    // 5. Execute Deterministic Core ATS Analysis (MANDATORY & ISOLATED)
    const result = ATSEngine.evaluate(finalResumeText, finalJdText);
    logger.info(`[ATS Stage] ATS_EVALUATED (Score: ${result.atsScore}%, Matched: ${result.matchedSkills.length}, Missing: ${result.missingSkills.length})`);

    // 6. Generate Gemini AI Resume Suggestions (OPTIONAL ENRICHMENT — NEVER FAILS ATS ROUTE)
    let aiSuggestions = null;
    try {
      aiSuggestions = await generateGeminiAtsSuggestions({
        resumeText: finalResumeText,
        jdText: finalJdText,
        jobTitle: jobTitleInput,
        atsBreakdown: result,
      });
      logger.info(`[ATS Stage] GEMINI_COMPLETE (available: ${aiSuggestions.available})`);
    } catch (err) {
      logger.warn("[ATS Stage] Gemini suggestion enrichment failed gracefully", err);
      aiSuggestions = {
        strengths: [],
        missingSkills: [],
        experienceAlignment: [],
        projectRecommendations: [],
        resumeImprovements: [],
        available: false,
        notice: "AI resume suggestions are temporarily unavailable. Your deterministic ATS match score is fully computed below.",
      };
    }

    const latencyMs = Date.now() - startTime;
    logger.info(`[ATS Stage] REQUEST_COMPLETE in ${latencyMs}ms`);

    return NextResponse.json({
      success: true,
      result,
      aiSuggestions,
      resumeExtractedLength: finalResumeText.length,
      jdExtractedLength: finalJdText.length,
      latencyMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[ATS Stage] ATS Calculator API Uncaught Server Error", err);
    return NextResponse.json(
      {
        error: "ATS_ANALYSIS_FAILED",
        message: "Unable to complete ATS analysis due to a temporary server processing issue. Please check your document inputs and try again.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
