-- Icerik altyazi onbellegi: admin bir altyaziyi belirli bir filme ELLE ekler; icerik burada saklanir.
CREATE TABLE IF NOT EXISTS "stream_subtitles" (
  "id" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "label" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stream_subtitles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stream_subtitles_streamId_language_key" ON "stream_subtitles"("streamId", "language");
CREATE INDEX IF NOT EXISTS "stream_subtitles_streamId_idx" ON "stream_subtitles"("streamId");
