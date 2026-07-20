-- Self-servis magaza: paket "isPublic" ile satisa acilir; misafir siparisi store_orders'a duser.
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "store_orders" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contactEmail" TEXT NOT NULL,
  "desiredUsername" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provisionedUserId" TEXT,
  "provisionedUsername" TEXT,
  "provisionedPassword" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "store_orders_status_idx" ON "store_orders"("status");
