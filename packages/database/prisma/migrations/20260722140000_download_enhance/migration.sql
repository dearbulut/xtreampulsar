-- Indirme yoneticisi gelistirmeleri: hiz siniri, es zamanlilik, oto-VOD, is onceligi.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "downloadSpeedKbps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "downloadConcurrency" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "downloadAutoVod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "autoVod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
