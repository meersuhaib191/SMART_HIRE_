import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAppClient } from "@/utils/supabase/application";
import { stageTransitionService } from "@/services/stage-transition-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { applicationId, action, rejectionCategory, rejectionNotes, internalNotes } = body;

    if (!applicationId || !action) {
      return NextResponse.json({ error: "applicationId and action are required" }, { status: 400 });
    }

    const appSupabase = await createAppClient();

    if (action === "approve") {
      // Transition to Offer stage
      const result = await stageTransitionService.transitionStage({
        applicationId,
        destinationStage: "offer",
        changedByUserId: user.id,
        notes: internalNotes || "Approved for offer after Recruiter Final Interview evaluation",
      });

      await appSupabase
        .from("applications")
        .update({
          decision_status: "approved_for_offer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      return NextResponse.json({ success: true, result, nextStage: "offer" });
    } else if (action === "hold") {
      await appSupabase
        .from("applications")
        .update({
          decision_status: "on_hold",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      return NextResponse.json({ success: true, decisionStatus: "on_hold" });
    } else if (action === "reject") {
      await appSupabase
        .from("applications")
        .update({
          rejection_reason_category: rejectionCategory || "Interview Evaluation",
          rejection_notes: rejectionNotes || internalNotes || null,
          decision_status: "rejected",
          status: "rejected",
          rejection_stage: "hiring_decision",
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      // Log history
      try {
        await appSupabase.from("application_status_history").insert({
          application_id: applicationId,
          from_status: "hiring_decision",
          to_status: "rejected",
          notes: `Rejected during Hiring Decision (${rejectionCategory || 'Interview Evaluation'}): ${internalNotes || ''}`,
          changed_by: user.id,
        });
      } catch {
        // Safe fallback
      }

      return NextResponse.json({ success: true, decisionStatus: "rejected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[API/HiringDecision] Error", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
