-- AlterTable users: trial account fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isTrial"     BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- AlterTable settings: trial defaults
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "trialDays"           INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "trialMaxConnections" INTEGER NOT NULL DEFAULT 1;
