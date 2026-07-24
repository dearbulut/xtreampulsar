-- Watch-folder auto-import (A)
ALTER TABLE "settings" ADD COLUMN "watchFolderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "watchFolderPath" TEXT;
ALTER TABLE "settings" ADD COLUMN "watchFolderBouquetId" TEXT;
ALTER TABLE "settings" ADD COLUMN "watchFolderIntervalMins" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE "watch_imports" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "streamId" TEXT,
    "episodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watch_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "watch_imports_path_key" ON "watch_imports"("path");
CREATE INDEX "watch_imports_createdAt_idx" ON "watch_imports"("createdAt");
