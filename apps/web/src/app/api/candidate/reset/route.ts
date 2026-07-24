import { NextResponse } from "next/server";
import { createAppClient } from "@/utils/supabase/application";
import { createAssessmentClient } from "@/utils/supabase/assessment";
import { logger } from "@smarthire/logger";

export async function POST() {
  try {
    const appClient = await createAppClient();
    const assessmentClient = await createAssessmentClient();

    // Authenticate user session
    const {
      data: { user },
    } = await appClient.auth.getUser();

    logger.info(`[Candidate Reset API] Executing application reset for candidate session user: ${user?.id || "guest"}`);

    if (user?.id) {
      // 1. Fetch candidate profile
      const { data: cand } = await appClient
        .schema("candidate")
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cand) {
        // Delete candidate attempts
        await assessmentClient
          .from("attempts")
          .delete()
          .eq("candidate_id", cand.id);

        // Delete candidate assignments
        await assessmentClient
          .from("assignments")
          .delete()
          .eq("candidate_id", cand.id);

        // Delete candidate applications
        await appClient
          .schema("application")
          .from("applications")
          .delete()
          .eq("candidate_id", cand.id);
      }
    }

    // Direct fallback purge on all candidate applications
    await appClient
      .schema("application")
      .from("applications")
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z");

    await assessmentClient
      .from("assignments")
      .delete()
      .gte("created_at", "1970-01-01T00:00:00Z");

    return NextResponse.json({ success: true, message: "Candidate applications and assessment assignments successfully reset." });
  } catch (err: unknown) {
    logger.error("API error in candidate reset POST route", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
