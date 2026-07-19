-- AI destek botu ayarları (uykuda; anahtar girilene kadar çalışmaz)
ALTER TABLE "settings" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE "settings" ADD COLUMN "aiApiKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "aiModel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "settings" ADD COLUMN "aiSystemPrompt" TEXT;
