-- AlterTable: Settings — panel geo-block fields
ALTER TABLE "settings" ADD COLUMN "geoBlockEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "allowedCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable: User — 2FA enforcement flag
ALTER TABLE "users" ADD COLUMN "require2FA" BOOLEAN NOT NULL DEFAULT false;
