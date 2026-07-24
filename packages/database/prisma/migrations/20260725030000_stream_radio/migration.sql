-- Roadmap E: Radyo istasyonlari — LIVE stream'e radyo bayragi
ALTER TABLE "streams" ADD COLUMN "isRadio" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "streams_isRadio_idx" ON "streams"("isRadio");
