-- CreateTable
CREATE TABLE "reseller_refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resellerId" TEXT NOT NULL,

    CONSTRAINT "reseller_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reseller_refresh_tokens_token_key" ON "reseller_refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "reseller_refresh_tokens_resellerId_idx" ON "reseller_refresh_tokens"("resellerId");

-- CreateIndex
CREATE INDEX "reseller_refresh_tokens_token_idx" ON "reseller_refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "reseller_refresh_tokens" ADD CONSTRAINT "reseller_refresh_tokens_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
