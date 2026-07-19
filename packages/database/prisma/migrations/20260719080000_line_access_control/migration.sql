-- Hat erişim kontrolü: IP/ülke/cihaz kilidi + VPN engelleme
ALTER TABLE "users" ADD COLUMN "allowedIps" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "allowedCountries" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "blockVpn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "lockDevice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "lockedDeviceId" TEXT;
