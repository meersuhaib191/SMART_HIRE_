import { NextRequest, NextResponse } from "next/server";
import { createCandClient } from "@/utils/supabase/candidate";
import { candidateService } from "@/services/candidate-service";
import { resumeService } from "@/services/resume-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

/**
 * GET: Retrieve list of resumes for candidate
 */
export async function GET() {
  try {
    const supabase = await createCandClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Retrieve candidate profile
    const profile = await candidateService.getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Candidate profile not initialized" }, { status: 400 });
    }

    logger.info(`API: Listing resumes for candidate: ${profile.id}`);
    const resumes = await resumeService.listResumes(profile.id);

    return NextResponse.json({ data: resumes });
  } catch (err) {
    logger.error("API error in resumes GET route", err);
    return NextResponse.json({ error: "Failed to list resumes" }, { status: 500 });
  }
}

/**
 * POST: Upload new resume version (Multipart Form-Data)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createCandClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Retrieve candidate profile
    const profile = await candidateService.getProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Candidate profile must be initialized first" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No valid file field 'file' provided" }, { status: 400 });
    }

    logger.info(`API: Uploading resume file: ${file.name} for candidate: ${profile.id}`);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const resumeRecord = await resumeService.uploadResume(
      profile.id,
      file.name,
      buffer,
      file.type,
      file.size
    );

    return NextResponse.json({ data: resumeRecord }, { status: 201 });
  } catch (err: unknown) {
    logger.error("API error in resumes POST route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Upload failed", message }, { status: 400 });
  }
}
