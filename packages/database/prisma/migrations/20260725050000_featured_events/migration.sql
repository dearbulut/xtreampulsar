-- Roadmap G: One cikan canli etkinlikler
CREATE TABLE "featured_events" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "logoUrl"     TEXT,
  "startsAt"    TIMESTAMP(3),
  "streamId"    TEXT,
  "categoryId"  TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "featured_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "featured_events_isActive_startsAt_idx" ON "featured_events"("isActive", "startsAt");
