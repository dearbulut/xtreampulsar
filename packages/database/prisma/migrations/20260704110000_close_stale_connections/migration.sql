-- Hayalet (stale) bağlantı temizliği: HLS istemcisi "ayrıldım" demediğinden
-- endedAt=null olarak asılı kalıp maxConnections kotasını bloke eden kayıtları kapat.
-- Deploy anında GERÇEK izleyiciyi kesmemek için muhafazakâr 5 dakika eşiği kullanılır
-- (canlı izleyen Connection.updatedAt'i ~10-30sn'de tazeler; 5dk hareketsiz = kesin
-- hayalet). Runtime cron 90sn eşiğiyle sürekli temizlemeye devam eder.
UPDATE "connections"
SET "endedAt" = now()
WHERE "endedAt" IS NULL
  AND "updatedAt" < now() - interval '5 minutes';
