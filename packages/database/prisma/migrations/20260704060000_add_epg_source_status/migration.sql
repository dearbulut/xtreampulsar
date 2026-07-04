-- EPGSource: parse durumu ve son hata mesajı (fire-and-forget parse takibi için).
ALTER TABLE "epg_sources" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'IDLE';
ALTER TABLE "epg_sources" ADD COLUMN "lastError" TEXT;
