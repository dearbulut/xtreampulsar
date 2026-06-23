-- Add isRead field to notification_logs
ALTER TABLE "notification_logs"
  ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false;
