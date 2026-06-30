-- CreateTable
CREATE TABLE "reseller_notifications" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reseller_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reseller_notifications_resellerId_isRead_idx" ON "reseller_notifications"("resellerId", "isRead");

-- AddForeignKey
ALTER TABLE "reseller_notifications" ADD CONSTRAINT "reseller_notifications_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
