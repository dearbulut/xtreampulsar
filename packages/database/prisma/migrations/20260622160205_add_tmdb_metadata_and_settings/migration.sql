-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "autoEnrichMetadata" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tmdbApiKey" TEXT;

-- AlterTable
ALTER TABLE "streams" ADD COLUMN     "backdropUrl" TEXT,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "posterUrl" TEXT,
ADD COLUMN     "releaseYear" INTEGER,
ADD COLUMN     "tmdbGenres" TEXT[],
ADD COLUMN     "tmdbId" INTEGER,
ADD COLUMN     "tmdbRating" DOUBLE PRECISION;
