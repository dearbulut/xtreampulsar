-- Website Widgets — embeddable trial/store/renewal widgets

CREATE TABLE "widgets" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STORE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "subtitle" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#6d28d9',
    "trialPackageId" TEXT,
    "trialDurationDays" INTEGER NOT NULL DEFAULT 1,
    "allowedPackageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "successMessage" TEXT,
    "redirectUrl" TEXT,
    "perIpDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "widgets_publicKey_key" ON "widgets"("publicKey");

CREATE TABLE "widget_leads" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "email" TEXT,
    "username" TEXT,
    "result" TEXT NOT NULL DEFAULT 'OK',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "widget_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "widget_leads_widgetId_createdAt_idx" ON "widget_leads"("widgetId", "createdAt");
CREATE INDEX "widget_leads_ip_createdAt_idx" ON "widget_leads"("ip", "createdAt");

ALTER TABLE "widget_leads" ADD CONSTRAINT "widget_leads_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
