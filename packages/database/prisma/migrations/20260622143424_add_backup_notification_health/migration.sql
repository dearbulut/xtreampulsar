-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "adminEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "autoBackupIntervalHours" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "backupsToKeep" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "dropboxApiKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "enableLocalBackups" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableRemoteBackup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "localBackupDir" TEXT NOT NULL DEFAULT '/opt/xtreampulsar/backups',
ADD COLUMN     "resellerNotifyExpiry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "streamDownAlert" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "streams" ADD COLUMN     "healthStatus" TEXT,
ADD COLUMN     "lastHealthCheck" TIMESTAMP(3),
ADD COLUMN     "uptimePercent" DOUBLE PRECISION DEFAULT 100;

-- CreateTable
CREATE TABLE "backup_logs" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOCAL',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stream_health_logs" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseTime" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stream_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stream_health_logs_streamId_checkedAt_idx" ON "stream_health_logs"("streamId", "checkedAt");

-- AddForeignKey
ALTER TABLE "stream_health_logs" ADD CONSTRAINT "stream_health_logs_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
