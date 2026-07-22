-- Restreamer/scraper tespiti: bir pencerede anormal sayida farkli kanala baglanan hat (ripper) tespiti.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "restreamDetectEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "restreamWindowMins" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "restreamDistinctThreshold" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "restreamAutoBan" BOOLEAN NOT NULL DEFAULT false;
