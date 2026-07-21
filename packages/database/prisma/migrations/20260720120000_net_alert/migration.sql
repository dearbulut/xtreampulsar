-- Bant genisligi izleme uyari esigi (Mbps).
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "netAlertMbps" INTEGER NOT NULL DEFAULT 0;
