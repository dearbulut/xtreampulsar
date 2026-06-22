/*
  Warnings:

  - Added the required column `updatedAt` to the `connections` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "connections_updatedAt_idx" ON "connections"("updatedAt");
