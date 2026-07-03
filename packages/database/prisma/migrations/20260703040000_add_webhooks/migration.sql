-- CreateTable: webhooks
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "url"           TEXT NOT NULL,
  "secret"        TEXT,
  "events"        TEXT[] NOT NULL DEFAULT '{}',
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "lastTriggered" TIMESTAMP(3),
  "lastStatus"    INTEGER,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);
