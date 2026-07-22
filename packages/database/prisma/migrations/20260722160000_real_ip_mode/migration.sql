-- Anti-piracy: Cloudflare/proxy arkasi gercek client IP kaynagi (auto|cf|xff-first|xff-last).
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "realIpMode" TEXT NOT NULL DEFAULT 'auto';
