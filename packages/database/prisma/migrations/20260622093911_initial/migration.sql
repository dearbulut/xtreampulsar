-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "LicenseTier" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'WHITE_LABEL');

-- CreateEnum
CREATE TYPE "ServerRole" AS ENUM ('MAIN', 'LOAD_BALANCER');

-- CreateEnum
CREATE TYPE "StreamStatus" AS ENUM ('ONLINE', 'OFFLINE', 'BUFFERING', 'ERROR');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('IDLE', 'RUNNING', 'CRASHED', 'STOPPED');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('LIVE', 'VOD', 'SERIES');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED', 'BANNED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESELLER', 'USER');

-- CreateEnum
CREATE TYPE "ResellerTier" AS ENUM ('BASIC', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "CreditLogType" AS ENUM ('ADD', 'DEDUCT');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationSource" AS ENUM ('XTREAMUI', 'XUIONE', 'M3U', 'XTREAM_API');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LICENSE_VALIDATE', 'STREAM_START', 'STREAM_STOP');

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "serverIp" TEXT,
    "tier" "LicenseTier" NOT NULL DEFAULT 'STARTER',
    "status" "LicenseStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_verification_logs" (
    "id" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "serverIp" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8080,
    "role" "ServerRole" NOT NULL DEFAULT 'MAIN',
    "maxClients" INTEGER NOT NULL DEFAULT 1000,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "responseTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bouquets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bouquets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "externalId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bouquetId" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streams" (
    "id" TEXT NOT NULL,
    "externalId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "primaryUrl" TEXT NOT NULL,
    "backupUrl" TEXT,
    "ffmpegPid" INTEGER,
    "workerStatus" "WorkerStatus" NOT NULL DEFAULT 'IDLE',
    "restartCount" INTEGER NOT NULL DEFAULT 0,
    "status" "StreamStatus" NOT NULL DEFAULT 'OFFLINE',
    "tvgId" TEXT,
    "tvgLogo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "serverId" TEXT,

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bouquet_streams" (
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "bouquetId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,

    CONSTRAINT "bouquet_streams_pkey" PRIMARY KEY ("bouquetId","streamId")
);

-- CreateTable
CREATE TABLE "epg_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "xmltvUrl" TEXT NOT NULL,
    "lastParsed" TIMESTAMP(3),
    "daysToKeep" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epg_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epg_mappings" (
    "id" TEXT NOT NULL,
    "epgChannelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "streamId" TEXT NOT NULL,
    "epgSourceId" TEXT NOT NULL,

    CONSTRAINT "epg_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epg_channels" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "epgSourceId" TEXT NOT NULL,

    CONSTRAINT "epg_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epg_programmes" (
    "id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "stop" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "epgChannelId" TEXT NOT NULL,

    CONSTRAINT "epg_programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resellers" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "tier" "ResellerTier" NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "resellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_credit_logs" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditLogType" NOT NULL,
    "reason" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resellerId" TEXT NOT NULL,

    CONSTRAINT "reseller_credit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "maxConnections" INTEGER NOT NULL DEFAULT 1,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resellerId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxConnections" INTEGER NOT NULL DEFAULT 1,
    "creditCost" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "bytesIn" BIGINT NOT NULL DEFAULT 0,
    "bytesOut" BIGINT NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "serverId" TEXT,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_jobs" (
    "id" TEXT NOT NULL,
    "source" "MigrationSource" NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorId" TEXT,
    "actorType" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_key_key" ON "licenses"("key");

-- CreateIndex
CREATE INDEX "license_verification_logs_licenseKey_createdAt_idx" ON "license_verification_logs"("licenseKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "servers_ip_key" ON "servers"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "categories_externalId_key" ON "categories"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "streams_externalId_key" ON "streams"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "epg_mappings_streamId_epgSourceId_key" ON "epg_mappings"("streamId", "epgSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "epg_channels_epgSourceId_channelId_key" ON "epg_channels"("epgSourceId", "channelId");

-- CreateIndex
CREATE INDEX "epg_programmes_epgChannelId_start_idx" ON "epg_programmes"("epgChannelId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "resellers_username_key" ON "resellers"("username");

-- CreateIndex
CREATE UNIQUE INDEX "resellers_email_key" ON "resellers"("email");

-- CreateIndex
CREATE INDEX "reseller_credit_logs_resellerId_idx" ON "reseller_credit_logs"("resellerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "connections_userId_endedAt_idx" ON "connections"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "connections_streamId_endedAt_idx" ON "connections"("streamId", "endedAt");

-- CreateIndex
CREATE INDEX "connections_startedAt_idx" ON "connections"("startedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_actorType_idx" ON "audit_logs"("actorId", "actorType");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "license_verification_logs" ADD CONSTRAINT "license_verification_logs_licenseKey_fkey" FOREIGN KEY ("licenseKey") REFERENCES "licenses"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_bouquetId_fkey" FOREIGN KEY ("bouquetId") REFERENCES "bouquets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streams" ADD CONSTRAINT "streams_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streams" ADD CONSTRAINT "streams_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bouquet_streams" ADD CONSTRAINT "bouquet_streams_bouquetId_fkey" FOREIGN KEY ("bouquetId") REFERENCES "bouquets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bouquet_streams" ADD CONSTRAINT "bouquet_streams_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epg_mappings" ADD CONSTRAINT "epg_mappings_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epg_mappings" ADD CONSTRAINT "epg_mappings_epgSourceId_fkey" FOREIGN KEY ("epgSourceId") REFERENCES "epg_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epg_channels" ADD CONSTRAINT "epg_channels_epgSourceId_fkey" FOREIGN KEY ("epgSourceId") REFERENCES "epg_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epg_programmes" ADD CONSTRAINT "epg_programmes_epgChannelId_fkey" FOREIGN KEY ("epgChannelId") REFERENCES "epg_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "resellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_credit_logs" ADD CONSTRAINT "reseller_credit_logs_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
