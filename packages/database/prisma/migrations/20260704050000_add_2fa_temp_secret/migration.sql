-- AlterTable: User — add temporary 2FA secret used during setup.
-- The permanent twoFactorSecret is only written on successful confirmation,
-- so re-opening the setup flow can no longer clobber an active secret.
ALTER TABLE "users" ADD COLUMN "twoFactorTempSecret" TEXT;
