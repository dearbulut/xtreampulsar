-- Panel geneli varsayilan para birimi (admin secer, tum fiyat gosterimleri buna gore).
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TRY';
