-- Aktivasyon kodu = hazir abone hatti (username = password = code).
-- Kod uretmek = hat olusturmak. Bagli hattin id'sini ve (varsa) paketi sakla.
ALTER TABLE "activation_codes" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "activation_codes" ADD COLUMN IF NOT EXISTS "packageId" TEXT;
