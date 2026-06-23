-- Add streamMode column to streams table
-- PROXY = direct passthrough (no FFmpeg), TRANSCODE = FFmpeg HLS (existing behaviour)
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "streamMode" TEXT NOT NULL DEFAULT 'PROXY';
