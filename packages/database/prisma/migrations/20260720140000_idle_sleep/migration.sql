-- On-demand uyutma: izleyicisi olmayan TRANSCODE yayinini durdurup CPU/RAM tasarrufu (istek gelince otomatik uyanir).
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "idleSleepEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "idleSleepMins" INTEGER NOT NULL DEFAULT 10;
