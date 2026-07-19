-- CreateEnum
CREATE TYPE "ClientRequestType" AS ENUM ('REPORT', 'NEW_CHANNEL');
CREATE TYPE "ClientRequestStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "client_requests" (
    "id" TEXT NOT NULL,
    "type" "ClientRequestType" NOT NULL,
    "status" "ClientRequestStatus" NOT NULL DEFAULT 'OPEN',
    "userId" TEXT NOT NULL,
    "streamId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "client_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_requests_status_idx" ON "client_requests"("status");
CREATE INDEX "client_requests_type_idx" ON "client_requests"("type");

-- AddForeignKey
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
