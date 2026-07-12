-- Bouquet'siz aktif kullanıcıların playlist'i boş geliyordu (fail-closed
-- entitlement). Onlara "Default" bouquet'i ata. Idempotent + güvenli:
-- mevcut bouquet'i OLAN kullanıcılara dokunmaz.

-- 1) "Default" bouquet yoksa oluştur (id String; uuid yeterli, cuid şart değil).
INSERT INTO "bouquets" ("id", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Default', 0, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "bouquets" WHERE "name" = 'Default');

-- 2) Hiç bouquet'i olmayan, silinmemiş, aktif kullanıcılara Default'u ata.
INSERT INTO "user_bouquets" ("userId", "bouquetId")
SELECT u."id", b."id"
FROM "users" u
CROSS JOIN (SELECT "id" FROM "bouquets" WHERE "name" = 'Default' ORDER BY "createdAt" ASC LIMIT 1) b
WHERE u."deletedAt" IS NULL
  AND u."status" = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM "user_bouquets" ub WHERE ub."userId" = u."id")
ON CONFLICT DO NOTHING;
