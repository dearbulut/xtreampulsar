-- Operator indirme yoneticisi: URL'den arka planda (aria2, cok-baglantili + resume) indirme isleri.
CREATE TABLE IF NOT EXISTS "download_jobs" (
  "id"              TEXT NOT NULL,
  "url"             TEXT NOT NULL,
  "filename"        TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'QUEUED',
  "totalBytes"      BIGINT NOT NULL DEFAULT 0,
  "downloadedBytes" BIGINT NOT NULL DEFAULT 0,
  "speedBps"        INTEGER NOT NULL DEFAULT 0,
  "connections"     INTEGER NOT NULL DEFAULT 16,
  "error"           TEXT,
  "categoryId"      TEXT,
  "createdStreamId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "download_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "download_jobs_status_idx" ON "download_jobs"("status");
