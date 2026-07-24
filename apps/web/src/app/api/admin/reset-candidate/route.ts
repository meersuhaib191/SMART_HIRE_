import { NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { logger } from "@smarthire/logger";

export async function GET() {
  try {
    const appClient = await createAppClient();
    const assessmentClient = await createAssessmentClient();

    logger.info("[Reset Candidate API] Purging schema('application').applications and schema('assessment').assignments...");

    const nowIso = new Date().toISOString();

    // 1. Delete or soft delete all attempts in assessment schema
    const { count: attemptsCount } = await assessmentClient
      .from("attempts")
      .delete({ count: "exact" })
      .gte("created_at", "1970-01-01T00:00:00Z");

    // 2. Delete or soft delete all assignments in assessment schema
    const { count: assignmentsCount } = await assessmentClient
      .from("assignments")
      .delete({ count: "exact" })
      .gte("created_at", "1970-01-01T00:00:00Z");

    // 3. Delete or update application_status_history in application schema
    try {
      await appClient
        .schema("application")
        .from("application_status_history")
        .delete()
        .gte("created_at", "1970-01-01T00:00:00Z");
    } catch (e) {
      logger.warn("Status history delete skipped", e);
    }

    // Fetch all candidate IDs
    const { data: candList } = await appClient
      .schema("candidate")
      .from("candidates")
      .select("id");

    const candIds = (candList || []).map((c) => c.id);

    let updatedCount = 0;

    if (candIds.length > 0) {
      const { data: updatedApps } = await appClient
        .schema("application")
        .from("applications")
        .update({ deleted_at: nowIso, status: "deleted" })
        .in("candidate_id", candIds)
        .select("id");

      updatedCount = updatedApps?.length || 0;
    } else {
      // Direct update without candidate_id filter
      const { data: updatedApps } = await appClient
        .schema("application")
        .from("applications")
        .update({ deleted_at: nowIso, status: "deleted" })
        .is("deleted_at", null)
        .select("id");

      updatedCount = updatedApps?.length || 0;
    }

    // 5. Hard delete all applications in application schema
    const { data: deletedApps, error: delErr } = await appClient
      .schema("application")
      .from("applications")
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z")
      .select("id");

    if (delErr) {
      logger.error("Error hard deleting schema('application').applications", delErr);
    }

    return NextResponse.json({
      success: true,
      message: "Successfully reset all candidate applications and assessment assignments across schema('application') and schema('assessment').",
      updatedApplications: updatedCount,
      deletedApplications: deletedApps?.length || 0,
      deletedAssignments: assignmentsCount || 0,
      deletedAttempts: attemptsCount || 0,
    });
  } catch (err: unknown) {
    logger.error("API error in reset candidate GET route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
