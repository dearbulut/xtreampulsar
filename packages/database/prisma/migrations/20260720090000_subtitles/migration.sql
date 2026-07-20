-- Altyazi arama/indirme (OpenSubtitles) yapilandirmasi. Bos = uykuda.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subtitleEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subtitleApiKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subtitleUsername" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subtitlePassword" TEXT NOT NULL DEFAULT '';
