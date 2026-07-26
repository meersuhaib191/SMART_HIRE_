import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { MeetingService } from "@/services/interview/meeting-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Meeting token required" }, { status: 400 });
    }

    const supabase = await createClient();
    const sessionData = await MeetingService.getSessionByToken(token, supabase);
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid or expired meeting token" }, { status: 404 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    let role: "recruiter" | "candidate" = "candidate";
    let displayName = sessionData.candidateName || "Candidate";

    if (user) {
      // Check if user is recruiter for company
      const { data: rec } = await supabase
        .schema("organization")
        .from("recruiters")
        .select("id, first_name, last_name, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (rec) {
        role = "recruiter";
        const recName = `${rec.first_name || ""} ${rec.last_name || ""}`.trim();
        displayName = recName || sessionData.interviewerName || "Recruiter";
      } else {
        // User is candidate
        role = "candidate";
        const { data: cand } = await supabase
          .schema("candidate")
          .from("candidates")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .maybeSingle();

        const candName = cand ? `${cand.first_name || ""} ${cand.last_name || ""}`.trim() : "";
        displayName = candName || sessionData.candidateName || user.email?.split("@")[0] || "Candidate";
      }
    }

    return NextResponse.json({
      authorized: true,
      role,
      displayName,
      sessionData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[API/MeetingAuthorization] Error", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
