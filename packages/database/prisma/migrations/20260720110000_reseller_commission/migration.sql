-- Affiliate komisyon: referans kodu + referans eden bayi + komisyon defteri (kredi bazli).
ALTER TABLE "resellers" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "resellers" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "resellers_referralCode_key" ON "resellers"("referralCode");

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "commissionRate" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "reseller_commissions" (
  "id" TEXT NOT NULL,
  "resellerId" TEXT NOT NULL,
  "sourceResellerId" TEXT,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reseller_commissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reseller_commissions_resellerId_status_idx" ON "reseller_commissions"("resellerId", "status");
