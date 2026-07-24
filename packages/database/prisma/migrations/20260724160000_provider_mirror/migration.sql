-- Stream Providers & Mirrors — Increment 2 (channel/category mirroring)

-- Stream: mirror linkage back to the originating provider
ALTER TABLE "streams" ADD COLUMN "providerId" TEXT;
ALTER TABLE "streams" ADD COLUMN "providerRef" TEXT;
CREATE INDEX "streams_providerId_idx" ON "streams"("providerId");
ALTER TABLE "streams"
  ADD CONSTRAINT "streams_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "stream_providers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- StreamProvider: mirror configuration + last-sync stats
ALTER TABLE "stream_providers" ADD COLUMN "mirrorBouquetId" TEXT;
ALTER TABLE "stream_providers" ADD COLUMN "mirrorServerId" TEXT;
ALTER TABLE "stream_providers" ADD COLUMN "outputExt" TEXT NOT NULL DEFAULT 'ts';
ALTER TABLE "stream_providers" ADD COLUMN "dropPolicy" TEXT NOT NULL DEFAULT 'KEEP';
ALTER TABLE "stream_providers" ADD COLUMN "importLive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stream_providers" ADD COLUMN "importVod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stream_providers" ADD COLUMN "importSeries" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncAdded" INTEGER;
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncUpdated" INTEGER;
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncRemoved" INTEGER;
ALTER TABLE "stream_providers" ADD COLUMN "lastSyncTotal" INTEGER;
