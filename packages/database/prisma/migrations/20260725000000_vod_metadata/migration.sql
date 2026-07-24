-- VOD/Series metadata + settings parity (roadmap B)
ALTER TABLE "streams" ADD COLUMN "cast" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "streams" ADD COLUMN "director" TEXT;
ALTER TABLE "streams" ADD COLUMN "subtitlePath" TEXT;
ALTER TABLE "streams" ADD COLUMN "targetContainer" TEXT;
