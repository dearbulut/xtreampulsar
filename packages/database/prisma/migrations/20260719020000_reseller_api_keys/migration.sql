-- CreateTable
CREATE TABLE "reseller_api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reseller_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reseller_api_keys_key_key" ON "reseller_api_keys"("key");
CREATE INDEX "reseller_api_keys_key_idx" ON "reseller_api_keys"("key");
CREATE INDEX "reseller_api_keys_resellerId_idx" ON "reseller_api_keys"("resellerId");

-- AddForeignKey
ALTER TABLE "reseller_api_keys" ADD CONSTRAINT "reseller_api_keys_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
