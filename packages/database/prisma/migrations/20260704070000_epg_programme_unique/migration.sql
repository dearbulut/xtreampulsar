-- EPGProgramme: (epgChannelId, start) üzerinde mantıksal unique.
-- ÖNCE mevcut duplicate'leri temizle (aynı kanal+başlangıç için en yeniyi tut),
-- SONRA unique index ekle — aksi halde constraint eklerken patlar.

-- 1) createdAt'e göre eski duplicate'leri sil (en yeni createdAt kalır).
DELETE FROM "epg_programmes" a
USING "epg_programmes" b
WHERE a."epgChannelId" = b."epgChannelId"
  AND a."start" = b."start"
  AND (a."createdAt" < b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

-- 2) Eski (unique olmayan) index'i kaldır, unique index oluştur.
DROP INDEX IF EXISTS "epg_programmes_epgChannelId_start_idx";
CREATE UNIQUE INDEX "epg_programmes_epgChannelId_start_key"
  ON "epg_programmes" ("epgChannelId", "start");
