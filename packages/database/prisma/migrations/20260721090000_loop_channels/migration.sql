-- 24/7 looping kanallar: bir kaynak listesini sonsuz donguleyen sahte-canli kanal modu (LOOP).
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "loopSources" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "loopShuffle" BOOLEAN NOT NULL DEFAULT false;
