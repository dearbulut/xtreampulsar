-- Otomatik ban: kisa surede cok kez engellenen IP'leri otomatik banla.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "autoBanEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "autoBanThreshold" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "autoBanWindowMins" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "autoBanDurationMins" INTEGER NOT NULL DEFAULT 1440;
