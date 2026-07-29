-- Saglayicidan import edilen YENI yayinlarin baslangic modu.
-- Mevcut yayinlarin streamMode degeri senkronizasyonda artik EZILMIYOR
-- (bkz. provider.service.ts): toplu duzenlemeyle TRANSCODE'a alinan kanallar
-- her sync'te PROXY'e geri donmesin.
ALTER TABLE "stream_providers"
  ADD COLUMN IF NOT EXISTS "defaultStreamMode" TEXT NOT NULL DEFAULT 'PROXY';
