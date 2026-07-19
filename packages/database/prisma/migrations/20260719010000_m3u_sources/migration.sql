-- CreateTable
CREATE TABLE "m3u_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "defaultType" TEXT NOT NULL DEFAULT 'LIVE',
    "defaultBouquetId" TEXT,
    "conflictMode" TEXT NOT NULL DEFAULT 'MERGE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "lastSyncedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "m3u_sources_pkey" PRIMARY KEY ("id")
);
