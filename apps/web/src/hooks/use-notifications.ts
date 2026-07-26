"use client";

import { useNotificationContext } from "@/providers/NotificationContext";

/**
 * SMARTHIRE CENTRAL NOTIFICATION HOOK
 *
 * Universal hook for consuming unread counts, notification list,
 * real-time updates, and contextual unread state derivation across all panels.
 */
export function useNotifications() {
  return useNotificationContext();
}
