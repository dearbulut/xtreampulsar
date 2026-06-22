-- CreateTable
CREATE TABLE "white_labels" (
    "id" TEXT NOT NULL,
    "panelName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "customDomain" TEXT,
    "customCss" TEXT,
    "footerText" TEXT,
    "supportEmail" TEXT,
    "supportUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "licenseKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bandwidth_logs" (
    "id" TEXT NOT NULL,
    "streamId" TEXT,
    "serverId" TEXT,
    "bytesIn" BIGINT NOT NULL DEFAULT 0,
    "bytesOut" BIGINT NOT NULL DEFAULT 0,
    "hour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bandwidth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "white_labels_customDomain_key" ON "white_labels"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "white_labels_licenseKey_key" ON "white_labels"("licenseKey");

-- CreateIndex
CREATE INDEX "bandwidth_logs_hour_idx" ON "bandwidth_logs"("hour");

-- CreateIndex
CREATE UNIQUE INDEX "bandwidth_logs_streamId_serverId_hour_key" ON "bandwidth_logs"("streamId", "serverId", "hour");
