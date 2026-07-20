-- Operator → musteri/bayi faturasi (lisans planindaki Invoice'dan ayri).
CREATE TABLE IF NOT EXISTS "panel_invoices" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "status" TEXT NOT NULL DEFAULT 'UNPAID',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "panel_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "panel_invoices_number_key" ON "panel_invoices"("number");
CREATE INDEX IF NOT EXISTS "panel_invoices_status_idx" ON "panel_invoices"("status");
