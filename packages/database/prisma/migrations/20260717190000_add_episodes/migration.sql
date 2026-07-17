CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "episode" INTEGER NOT NULL,
    "title" TEXT,
    "primaryUrl" TEXT NOT NULL,
    "containerExtension" TEXT NOT NULL DEFAULT 'mkv',
    "plot" TEXT,
    "durationSecs" INTEGER,
    "tmdbRating" DOUBLE PRECISION,
    "releaseDate" TEXT,
    "cover" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "episodes_seriesId_season_episode_key" ON "episodes"("seriesId", "season", "episode");
CREATE INDEX "episodes_seriesId_idx" ON "episodes"("seriesId");
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
