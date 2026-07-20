-- Bildirimler izleyenin diline gore cevrilebilsin diye anahtar + parametre sakla.
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "messageKey" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "messageParams" JSONB;
