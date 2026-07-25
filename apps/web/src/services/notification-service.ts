import { createBrowserClient } from "@supabase/ssr";
import { logger } from "@smarthire/logger";

const REAL_URL = "https://yljipgjfkfwacaspifcq.supabase.co";
const REAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsamlwZ2pma2Z3YWNhc3BpZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTkxNTEsImV4cCI6MjA5OTMzNTE1MX0.mR3IEFREknQ8y9RTZXMOcIZJHQzzGhDmzqmP7GrvAjg";

const notifClient = createBrowserClient(REAL_URL, REAL_KEY, { db: { schema: "notification" } });

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  subject: string;
  body: string;
  metadata?: Record<string, any> | null;
  idempotency_key?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export const notificationService = {
  /**
   * Create an in-app notification for a candidate/user with optional idempotency key
   */
  async createNotification(params: {
    userId: string;
    type: string;
    subject: string;
    body: string;
    metadata?: Record<string, any>;
    idempotencyKey?: string;
  }): Promise<NotificationItem | null> {
    try {
      if (params.idempotencyKey) {
        const { data: existing } = await notifClient
          .from("notifications")
          .select("id, user_id, type, subject, body, is_read, created_at")
          .eq("idempotency_key", params.idempotencyKey)
          .maybeSingle();

        if (existing) {
          logger.info(`[NotificationService] Idempotency match found for key: ${params.idempotencyKey}`);
          return existing as NotificationItem;
        }
      }

      const { data, error } = await notifClient
        .from("notifications")
        .insert({
          user_id: params.userId,
          type: params.type,
          subject: params.subject,
          body: params.body,
          metadata: params.metadata || {},
          idempotency_key: params.idempotencyKey || null,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        logger.error("[NotificationService] Failed to insert notification", error);
        return null;
      }

      return data as NotificationItem;
    } catch (err) {
      logger.error("[NotificationService] Exception creating notification", err);
      return null;
    }
  },

  /**
   * Fetch in-app notifications for authenticated candidate user
   */
  async getUserNotifications(userId: string, limit = 20): Promise<NotificationItem[]> {
    try {
      const { data, error } = await notifClient
        .from("notifications")
        .select("id, user_id, type, subject, body, metadata, idempotency_key, is_read, read_at, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("[NotificationService] Failed to fetch notifications", error);
        return [];
      }

      return (data || []) as NotificationItem[];
    } catch (err) {
      logger.error("[NotificationService] Exception fetching user notifications", err);
      return [];
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await notifClient
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .eq("user_id", userId);

      if (error) {
        logger.error("[NotificationService] Failed to mark read", error);
        return false;
      }

      return true;
    } catch (err) {
      logger.error("[NotificationService] Exception marking read", err);
      return false;
    }
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await notifClient
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) {
        logger.error("[NotificationService] Failed to mark all read", error);
        return false;
      }

      return true;
    } catch (err) {
      logger.error("[NotificationService] Exception marking all read", err);
      return false;
    }
  },
};
