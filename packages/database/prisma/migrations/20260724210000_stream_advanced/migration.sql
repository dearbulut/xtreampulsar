-- Stream advanced settings (Xtream UI parity — roadmap B)
ALTER TABLE "streams" ADD COLUMN "directSource" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "streams" ADD COLUMN "streamUserAgent" TEXT;
ALTER TABLE "streams" ADD COLUMN "httpProxy" TEXT;
ALTER TABLE "streams" ADD COLUMN "httpCookie" TEXT;
ALTER TABLE "streams" ADD COLUMN "httpHeaders" TEXT;
ALTER TABLE "streams" ADD COLUMN "customFfmpeg" TEXT;
ALTER TABLE "streams" ADD COLUMN "customMap" TEXT;
ALTER TABLE "streams" ADD COLUMN "probeSize" INTEGER;
ALTER TABLE "streams" ADD COLUMN "delayMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "streams" ADD COLUMN "transcodeProfile" TEXT;
ALTER TABLE "streams" ADD COLUMN "generatePts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "streams" ADD COLUMN "allowRecording" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "streams" ADD COLUMN "allowRtmpOutput" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "streams" ADD COLUMN "restartDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "streams" ADD COLUMN "restartTime" TEXT;
ALTER TABLE "streams" ADD COLUMN "epgSourceId" TEXT;
ALTER TABLE "streams" ADD COLUMN "epgLang" TEXT;
