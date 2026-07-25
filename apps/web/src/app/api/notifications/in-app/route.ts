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

    const notifications = await notificationService.getUserNotifications(user.id);
    return NextResponse.json({ data: notifications });
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

    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      const success = await notificationService.markAllAsRead(user.id);
      return NextResponse.json({ success });
    }

    if (notificationId) {
      const success = await notificationService.markAsRead(notificationId, user.id);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: "Missing notificationId or markAll parameter" }, { status: 400 });
  } catch (err) {
    logger.error("API error in POST /api/notifications/in-app", err);
    return NextResponse.json({ error: "Failed to update notification state" }, { status: 500 });
  }
}
