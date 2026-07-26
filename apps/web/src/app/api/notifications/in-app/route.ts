import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { notificationService } from "@/services/notification-service";
import { logger } from "@smarthire/logger";

export const dynamic = "force-dynamic";

/**
 * GET: Fetch in-app notifications for authenticated candidate user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .schema("notification")
      .from("notifications")
      .select("id, user_id, type, subject, body, metadata, idempotency_key, is_read, read_at, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.error("[API Notifications] Failed to fetch user notifications", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    logger.error("API error in GET /api/notifications/in-app", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

/**
 * POST: Mark single or all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationId, markAll } = body;

    if (markAll) {
      const { error } = await supabase
        .schema("notification")
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) logger.error("[API Notifications] Failed to mark all read", error);
      return NextResponse.json({ success: !error });
    }

    if (notificationId) {
      const { error } = await supabase
        .schema("notification")
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) logger.error("[API Notifications] Failed to mark read", error);
      return NextResponse.json({ success: !error });
    }

    return NextResponse.json({ error: "Missing notificationId or markAll parameter" }, { status: 400 });
  } catch (err) {
    logger.error("API error in POST /api/notifications/in-app", err);
    return NextResponse.json({ error: "Failed to update notification state" }, { status: 500 });
  }
}
