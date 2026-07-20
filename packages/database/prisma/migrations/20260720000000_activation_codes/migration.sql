-- Aktivasyon kodları (ön-ödemeli yenileme kartı)
CREATE TABLE "activation_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxConnections" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "usedByUserId" TEXT,
    "usedByUsername" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activation_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activation_codes_code_key" ON "activation_codes"("code");
CREATE INDEX "activation_codes_status_idx" ON "activation_codes"("status");
