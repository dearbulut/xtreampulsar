-- AlterTable: failover URL list for streams
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "backupUrls" TEXT[] NOT NULL DEFAULT '{}';
