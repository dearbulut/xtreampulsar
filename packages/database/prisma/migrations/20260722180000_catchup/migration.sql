-- Catch-up / DVR: yayini arsivle (geriye sarma). Increment 1: kayit altyapisi.
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "catchupEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "catchupDays" INTEGER NOT NULL DEFAULT 7;
