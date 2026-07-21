-- Sunucu-arasi kimlik: edge node NODE_SECRET ile eslesen paylasilan secret (metrik cekmek icin).
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "apiSecret" TEXT;
