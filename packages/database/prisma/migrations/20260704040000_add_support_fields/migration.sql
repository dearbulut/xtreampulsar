-- AlterTable: Ticket — add support tracking fields + license relation
ALTER TABLE "tickets" ADD COLUMN "licenseId"    TEXT;
ALTER TABLE "tickets" ADD COLUMN "panelUrl"     TEXT;
ALTER TABLE "tickets" ADD COLUMN "panelVersion" TEXT;
ALTER TABLE "tickets" ADD COLUMN "serverIp"     TEXT;

-- AddForeignKey: tickets → customer_licenses
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "customer_licenses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
