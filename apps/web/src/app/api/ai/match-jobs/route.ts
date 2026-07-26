import { NextRequest, NextResponse } from "next/server";
import { AIService, JobPosting } from "@/services/ai";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

/** POST /api/ai/match-jobs — Match a candidate profile against job postings */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      candidateSkills,
      candidateExperienceYears,
      resumeContent,
      jobs,
      topN,
    } = body as {
      candidateSkills: string[];
      candidateExperienceYears: number;
      resumeContent?: string;
      jobs: JobPosting[];
      topN?: number;
    };

    if (!candidateSkills || candidateExperienceYears === undefined || !jobs?.length) {
      return NextResponse.json(
        { error: "candidateSkills, candidateExperienceYears, and jobs are required" },
        { status: 400 }
      );
    }

    logger.info("[API] POST /api/ai/match-jobs");
    const result = await AIService.matchJobs({
      candidateSkills,
      candidateExperienceYears,
      resumeContent,
      jobs,
      topN,
    });
    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    logger.error("[API] match-jobs error", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Job matching failed", message }, { status: 500 });
  }
}
