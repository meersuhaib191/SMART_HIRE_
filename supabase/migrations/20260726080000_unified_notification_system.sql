-- Migration: Unified Notification System Enhancements
-- Creates indexes and ensures schema columns for efficient notification queries & context filtering

-- 1. Index for fast unread count and user feed sorting
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notification.notifications (user_id, is_read, created_at DESC) 
  WHERE deleted_at IS NULL;

-- 2. Index for fast contextual entity queries (e.g. metadata->>'entity_type', metadata->>'entity_id')
CREATE INDEX IF NOT EXISTS idx_notifications_user_entity_type 
  ON notification.notifications (user_id, (metadata->>'entity_type'), is_read) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_application_id 
  ON notification.notifications (user_id, (metadata->>'application_id'), is_read) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_job_id 
  ON notification.notifications (user_id, (metadata->>'job_id'), is_read) 
  WHERE deleted_at IS NULL;

-- 3. Idempotency Key unique constraint / index
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency 
  ON notification.notifications (idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
