import { NextRequest, NextResponse } from "next/server";
import { ATSEngine } from "@/services/ats/ats-engine";
import { extractTextFromAnyFileBuffer } from "@/utils/document-text-extractor";
import { generateGeminiAtsSuggestions } from "@/services/ai/gemini-ats-suggester";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const resumeFile = formData.get("resumeFile") as File | null;
    const resumeTextInput = (formData.get("resumeText") as string) || "";
    const jdFile = formData.get("jdFile") as File | null;
    const jdTextInput = (formData.get("jdText") as string) || "";

    let finalResumeText = resumeTextInput.trim();
    let finalJdText = jdTextInput.trim();

    // 1. Extract Resume text from any uploaded document format (.pdf, .docx, .json, .txt, etc.)
    if (resumeFile && resumeFile.size > 0) {
      try {
        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        const extracted = await extractTextFromAnyFileBuffer(buffer, resumeFile.name);
        if (extracted && extracted.trim().length > 0) {
          finalResumeText = extracted;
        }
      } catch (err) {
        logger.error("[ATS Calculator] Error extracting text from Resume file", err);
      }
    }

    // 2. Extract Job Description text from any uploaded document format (.pdf, .docx, .json, .txt, etc.)
    if (jdFile && jdFile.size > 0) {
      try {
        const buffer = Buffer.from(await jdFile.arrayBuffer());
        const extracted = await extractTextFromAnyFileBuffer(buffer, jdFile.name);
        if (extracted && extracted.trim().length > 0) {
          finalJdText = extracted;
        }
      } catch (err) {
        logger.error("[ATS Calculator] Error extracting text from JD file", err);
      }
    }

    if (!finalResumeText) {
      return NextResponse.json(
        { error: "Resume content is empty or unreadable. Please upload a valid document (.pdf, .docx, .txt) or paste raw text." },
        { status: 400 }
      );
    }

    if (!finalJdText) {
      return NextResponse.json(
        { error: "Job Description content is empty or unreadable. Please upload a valid document (.pdf, .docx, .txt) or paste raw text." },
        { status: 400 }
      );
    }

    // 3. Execute ATS Core Engine evaluation
    const result = ATSEngine.evaluate(finalResumeText, finalJdText);

    // 4. Generate AI Resume Suggestions via Gemini (Graceful fallback if unconfigured/failed)
    const jobTitleInput = (formData.get("jobTitle") as string) || "Target Position";
    let aiSuggestions = null;
    try {
      aiSuggestions = await generateGeminiAtsSuggestions({
        resumeText: finalResumeText,
        jdText: finalJdText,
        jobTitle: jobTitleInput,
        atsBreakdown: result,
      });
    } catch (err) {
      logger.warn("[ATS Calculator] Gemini suggestion generation failed gracefully", err);
      aiSuggestions = {
        strengths: [],
        missingSkills: [],
        experienceAlignment: [],
        projectRecommendations: [],
        resumeImprovements: [],
        available: false,
        notice: "AI recommendations are currently unavailable, but your ATS match score is fully computed below.",
      };
    }

    return NextResponse.json({
      success: true,
      result,
      aiSuggestions,
      resumeExtractedLength: finalResumeText.length,
      jdExtractedLength: finalJdText.length,
    });
  } catch (err: unknown) {
    logger.error("[ATS Calculator API] Failure", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to calculate ATS score", message }, { status: 500 });
  }
}

