-- AlterTable
ALTER TABLE "blocked_ips" ADD COLUMN     "bannedBy" TEXT,
ALTER COLUMN "serverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "server_guards" ADD COLUMN     "geoBlockedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "discordAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discordWebhookUrl" TEXT,
ADD COLUMN     "telegramAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramBotToken" TEXT,
ADD COLUMN     "telegramChatId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateIndex
CREATE INDEX "blocked_ips_ip_idx" ON "blocked_ips"("ip");
