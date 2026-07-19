-- VOD film süresi (saniye) — ffprobe ile doldurulur, Xtream get_vod_info duration_secs döner
ALTER TABLE "streams" ADD COLUMN "durationSecs" INTEGER;
