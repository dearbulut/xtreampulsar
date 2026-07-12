-- Xtream import artık explicit externalId (upstream stream_id) YAZMIYOR; yeni
-- stream'ler autoincrement alıyor. Mevcut import edilmiş stream'lerin explicit
-- externalId'leri sequence'i ilerletmediğinden, autoincrement değerleri onlarla
-- çakışabilir. Sequence'i mevcut MAX(externalId)'in üstüne çek.
-- Backward-compatible: mevcut satırları DEĞİŞTİRMEZ, yalnızca sequence'in bir
-- sonraki değerini ayarlar.
-- is_called=true iken nextval MAX+1 döner. Tablo boşsa MAX=0 → setval(seq,0)
-- geçersiz (min 1), bu yüzden is_called=false ile 1'den başlat.
DO $$
DECLARE
  seq text := pg_get_serial_sequence('streams', 'externalId');
  maxid bigint := (SELECT COALESCE(MAX("externalId"), 0) FROM streams);
BEGIN
  IF maxid > 0 THEN
    PERFORM setval(seq, maxid, true);   -- sonraki: maxid+1
  ELSE
    PERFORM setval(seq, 1, false);      -- tablo boş: sonraki: 1
  END IF;
END $$;
