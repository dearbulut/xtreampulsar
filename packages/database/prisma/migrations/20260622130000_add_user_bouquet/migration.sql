-- CreateTable
CREATE TABLE "user_bouquets" (
    "userId" TEXT NOT NULL,
    "bouquetId" TEXT NOT NULL,

    CONSTRAINT "user_bouquets_pkey" PRIMARY KEY ("userId","bouquetId")
);

-- AddForeignKey
ALTER TABLE "user_bouquets" ADD CONSTRAINT "user_bouquets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bouquets" ADD CONSTRAINT "user_bouquets_bouquetId_fkey" FOREIGN KEY ("bouquetId") REFERENCES "bouquets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
