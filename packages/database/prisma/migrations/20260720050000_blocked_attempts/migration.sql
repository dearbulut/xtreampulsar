-- Engellenen baglanti denemeleri (anti-abuse gorunurlugu): VPN/ulke/IP/cihaz/limit.
CREATE TABLE IF NOT EXISTS "blocked_attempts" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "username" TEXT,
  "ip" TEXT,
  "country" TEXT,
  "reason" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blocked_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "blocked_attempts_createdAt_idx" ON "blocked_attempts"("createdAt");
CREATE INDEX IF NOT EXISTS "blocked_attempts_category_idx" ON "blocked_attempts"("category");
