import { NextRequest, NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { applicationService } from "@/services/application-service";
import { logger } from "@smarthire/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH: Move application stage in hiring pipeline (status transition)
 * Supports all active stage enums: applied, screening, mcq, coding, interview, recruiter_review, zoom_interview, offer_sent, offered, offer_accepted, joined, rejected, withdrawn
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id: appId } = await params;
    const supabase = await createAppClient();

    // Authenticate user session with local recruiter fallback
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const recruiterId = user?.id || "00000000-0000-0000-0000-000000000000";

    const body = await request.json();
    logger.info(`API: Recruiter ${recruiterId} modifying status of application: ${appId}`);

    const updatedApp = await applicationService.updateStatus(appId, recruiterId, body);
    return NextResponse.json({ data: updatedApp });
  } catch (err: unknown) {
    logger.error("API error in application status update PATCH route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Pipeline status move failed", message }, { status: 400 });
  }
}
