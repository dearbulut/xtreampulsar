-- AlterTable: reseller tier pricing (settings) and max user quota (reseller)
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tierPricing" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "resellers" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 0;
