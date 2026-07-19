-- Destek taleplerinde iki yönlü mesaj thread'i (abone <-> admin)
CREATE TABLE "client_request_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_request_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "client_request_messages_requestId_idx" ON "client_request_messages"("requestId");
ALTER TABLE "client_request_messages" ADD CONSTRAINT "client_request_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "client_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
