-- Add retrievable plaintext password for admin M3U/Player URL display (Xtream-uyumlu)
ALTER TABLE "users" ADD COLUMN "plainPassword" TEXT;
