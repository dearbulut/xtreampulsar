-- Enhance user_activity_logs with session tracking fields
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "duration"         INTEGER;
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "bytesTransferred" BIGINT;
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "country"          TEXT;
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "deviceType"       TEXT;
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "endedAt"          TIMESTAMP(3);
