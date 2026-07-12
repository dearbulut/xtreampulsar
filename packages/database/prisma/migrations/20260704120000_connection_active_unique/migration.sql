-- Aynı user+stream için tek AÇIK bağlantı garantisi (findOrCreateConnection yarış
-- koşulu → duplicate bağlantı düzeltmesi). Partial unique index Prisma schema'da
-- temsil edilemediğinden migration-only; migrate deploy güvenli.

-- 1) Mevcut duplicate açık kayıtları temizle: her (userId, streamId) grubunda EN
--    YENİ (startedAt, eşitse id) kaydı tut, diğerlerini kapat (endedAt=now).
--    Aksi halde 2. adımdaki unique index oluşturulamaz (çakışma).
UPDATE "connections" c
SET "endedAt" = now()
WHERE c."endedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "connections" c2
    WHERE c2."userId"   = c."userId"
      AND c2."streamId" = c."streamId"
      AND c2."endedAt" IS NULL
      AND (c2."startedAt" > c."startedAt"
           OR (c2."startedAt" = c."startedAt" AND c2."id" > c."id"))
  );

-- 2) Partial unique index: aynı user+stream için en fazla bir açık bağlantı.
CREATE UNIQUE INDEX "connections_userId_streamId_active_key"
  ON "connections" ("userId", "streamId")
  WHERE "endedAt" IS NULL;
