-- CreateTable
CREATE TABLE "server_guards" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sensitivePorts" INTEGER[] DEFAULT ARRAY[22, 7999]::INTEGER[],
    "whitelistIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openPorts" INTEGER[] DEFAULT ARRAY[80, 25461, 443]::INTEGER[],
    "maxConnsPerIp" INTEGER NOT NULL DEFAULT 200,
    "maxHitsNormalUser" INTEGER NOT NULL DEFAULT 50,
    "maxHitsRestreamer" INTEGER NOT NULL DEFAULT 500,
    "whitelistUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockDurationMinutes" INTEGER NOT NULL DEFAULT 10,
    "denyInvalidStreamIds" BOOLEAN NOT NULL DEFAULT true,
    "blockVpnProxy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "server_guards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_ips" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "vodDownloadSpeed" INTEGER NOT NULL DEFAULT 200,
    "vodDownloadLimit" INTEGER NOT NULL DEFAULT 20,
    "bufferSize" INTEGER NOT NULL DEFAULT 8192,
    "blockVpnProxy" BOOLEAN NOT NULL DEFAULT false,
    "priorityBackupStream" BOOLEAN NOT NULL DEFAULT false,
    "streamDownVideo" TEXT,
    "bannedVideo" TEXT,
    "expiredVideo" TEXT,
    "countryLockVideo" TEXT,
    "maxConxExceedVideo" TEXT,
    "enableConxExceedLog" BOOLEAN NOT NULL DEFAULT false,
    "instantCloseConn" BOOLEAN NOT NULL DEFAULT false,
    "adminStreamingIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "panelName" TEXT NOT NULL DEFAULT 'XtreamPulsar',
    "serverUrl" TEXT NOT NULL DEFAULT '',
    "serverPort" INTEGER NOT NULL DEFAULT 25461,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "trialUserLimit" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "server_guards_serverId_key" ON "server_guards"("serverId");

-- CreateIndex
CREATE INDEX "blocked_ips_serverId_ip_idx" ON "blocked_ips"("serverId", "ip");

-- AddForeignKey
ALTER TABLE "server_guards" ADD CONSTRAINT "server_guards_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
