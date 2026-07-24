-- Stream Providers — Increment 3 (auto-sync interval + skip-keyword filters)
ALTER TABLE "stream_providers" ADD COLUMN "autoSync" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stream_providers" ADD COLUMN "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 720;
ALTER TABLE "stream_providers" ADD COLUMN "skipKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncStatus" TEXT;
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncMessage" TEXT;
