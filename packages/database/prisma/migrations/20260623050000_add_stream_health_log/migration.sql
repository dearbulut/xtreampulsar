-- Add errorMessage to stream_health_logs
ALTER TABLE "stream_health_logs" ADD COLUMN "errorMessage" TEXT;

-- Add lastError to streams
ALTER TABLE "streams" ADD COLUMN "lastError" TEXT;
