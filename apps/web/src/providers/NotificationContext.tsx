"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/utils/supabase/client";
import { NotificationItem } from "@/services/notification-service";
import { logger } from "@smarthire/logger";

export interface ContextFilter {
  entityType?:
    | "application"
    | "assessment"
    | "ai_interview_result"
    | "final_interview"
    | "offer"
    | "job"
    | "system";
  entityId?: string;
  jobId?: string;
  applicationId?: string;
  assessmentId?: string;
  category?:
    | "assessments"
    | "applications"
    | "interviews"
    | "pipeline"
    | "jobs"
    | "offers"
    | "admin";
  roundKey?: string;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  hasUnreadForContext: (filter: ContextFilter) => boolean;
  markContextAsRead: (filter: ContextFilter) => Promise<void>;
}

const NotificationContext = React.createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchNotifications = React.useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/notifications/in-app");
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setNotifications(json.data);
      }
    } catch (err) {
      logger.error("[NotificationProvider] Error fetching notifications", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch on mount or user change
  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time Supabase Postgres Channel Subscription
  React.useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channelName = `realtime_notifications_${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "notification",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          logger.info("[NotificationProvider] Realtime payload received", payload.eventType);
          fetchNotifications();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info(`[NotificationProvider] Realtime subscribed for user ${user.id}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  // Refetch on window focus / tab regain & 15s fallback interval
  React.useEffect(() => {
    if (!user) return;
    const handleFocus = () => {
      fetchNotifications();
    };
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(() => {
      fetchNotifications();
    }, 15000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [user, fetchNotifications]);

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const markAsRead = React.useCallback(
    async (notificationId: string) => {
      if (!user) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );

      try {
        await fetch("/api/notifications/in-app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId }),
        });
      } catch (err) {
        logger.error("[NotificationProvider] Error marking read", err);
        fetchNotifications();
      }
    },
    [user, fetchNotifications]
  );

  const markAllAsRead = React.useCallback(async () => {
    if (!user) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );

    try {
      await fetch("/api/notifications/in-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch (err) {
      logger.error("[NotificationProvider] Error marking all read", err);
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const hasUnreadForContext = React.useCallback(
    (filter: ContextFilter): boolean => {
      if (notifications.length === 0) return false;

      const unreadList = notifications.filter((n) => !n.is_read);
      if (unreadList.length === 0) return false;

      return unreadList.some((n) => {
        const meta = n.metadata || {};

        // Match exact entityId or applicationId if specified
        if (filter.entityId && (meta.entity_id === filter.entityId || n.id === filter.entityId)) {
          return true;
        }
        if (filter.applicationId && meta.application_id === filter.applicationId) {
          return true;
        }
        if (filter.assessmentId && meta.assessment_id === filter.assessmentId) {
          return true;
        }
        if (filter.jobId && meta.job_id === filter.jobId) {
          return true;
        }

        // Match roundKey (e.g. 'interview', 'mcq', 'coding', 'screening', 'offer')
        if (filter.roundKey) {
          const round = filter.roundKey.toLowerCase();
          if (round === "interview" && (n.type.includes("AI_INTERVIEW") || meta.entity_type === "ai_interview_result")) {
            return true;
          }
          if (round === "mcq" && (n.type.includes("MCQ") || meta.entity_type === "assessment")) {
            return true;
          }
          if (round === "coding" && (n.type.includes("CODING") || meta.entity_type === "assessment")) {
            return true;
          }
          if (round === "zoom_interview" && (n.type.includes("FINAL_INTERVIEW") || meta.entity_type === "final_interview")) {
            return true;
          }
          if (round === "offer" && (n.type.includes("OFFER") || meta.entity_type === "offer")) {
            return true;
          }
        }

        // Match general categories
        if (filter.category === "assessments") {
          return (
            meta.entity_type === "assessment" ||
            meta.entity_type === "ai_interview_result" ||
            n.type.includes("ASSESSMENT") ||
            n.type.includes("AI_INTERVIEW")
          );
        }

        if (filter.category === "applications") {
          return (
            meta.entity_type === "application" ||
            meta.entity_type === "offer" ||
            n.type.includes("APPLICATION") ||
            n.type.includes("OFFER")
          );
        }

        if (filter.category === "interviews") {
          return (
            meta.entity_type === "ai_interview_result" ||
            meta.entity_type === "final_interview" ||
            n.type.includes("INTERVIEW")
          );
        }

        if (filter.category === "pipeline") {
          return (
            meta.entity_type === "application" ||
            meta.entity_type === "ai_interview_result" ||
            meta.entity_type === "assessment" ||
            meta.entity_type === "final_interview" ||
            n.type.includes("AI_INTERVIEW") ||
            n.type.includes("APPLICATION")
          );
        }

        if (filter.category === "jobs") {
          return meta.entity_type === "job" || n.type.includes("JOB");
        }

        if (filter.category === "offers") {
          return meta.entity_type === "offer" || n.type.includes("OFFER");
        }

        if (filter.category === "admin") {
          return meta.entity_type === "system" || n.type.includes("SYSTEM");
        }

        if (filter.entityType && meta.entity_type === filter.entityType) {
          return true;
        }

        return false;
      });
    },
    [notifications]
  );

  const markContextAsRead = React.useCallback(
    async (filter: ContextFilter) => {
      const matching = notifications.filter((n) => {
        if (n.is_read) return false;
        const meta = n.metadata || {};

        if (filter.entityId && (meta.entity_id === filter.entityId || n.id === filter.entityId)) {
          return true;
        }
        if (filter.applicationId && meta.application_id === filter.applicationId) {
          return true;
        }
        if (filter.assessmentId && meta.assessment_id === filter.assessmentId) {
          return true;
        }
        if (filter.jobId && meta.job_id === filter.jobId) {
          return true;
        }

        if (filter.roundKey) {
          const round = filter.roundKey.toLowerCase();
          if (round === "interview" && (n.type.includes("AI_INTERVIEW") || meta.entity_type === "ai_interview_result")) {
            return true;
          }
          if (round === "mcq" && (n.type.includes("MCQ") || meta.entity_type === "assessment")) {
            return true;
          }
          if (round === "coding" && (n.type.includes("CODING") || meta.entity_type === "assessment")) {
            return true;
          }
          if (round === "zoom_interview" && (n.type.includes("FINAL_INTERVIEW") || meta.entity_type === "final_interview")) {
            return true;
          }
          if (round === "offer" && (n.type.includes("OFFER") || meta.entity_type === "offer")) {
            return true;
          }
        }

        return false;
      });

      if (matching.length === 0) return;

      // Mark all matching read
      for (const item of matching) {
        await markAsRead(item.id);
      }
    },
    [notifications, markAsRead]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        refetch: fetchNotifications,
        markAsRead,
        markAllAsRead,
        hasUnreadForContext,
        markContextAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
}
