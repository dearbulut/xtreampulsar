-- Widget trial anti-abuse: device fingerprint + one-per-device
ALTER TABLE "widgets" ADD COLUMN "oneTrialPerDevice" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "widget_leads" ADD COLUMN "deviceId" TEXT;
CREATE INDEX "widget_leads_widgetId_deviceId_idx" ON "widget_leads"("widgetId", "deviceId");
