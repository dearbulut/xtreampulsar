-- Roadmap H: YouTube kaynagi (yt-dlp)
ALTER TABLE "settings"
  ADD COLUMN "youtubeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "youtubeCookies" TEXT NOT NULL DEFAULT '';
