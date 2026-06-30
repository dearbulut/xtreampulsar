-- AlterTable: add branding fields to resellers
ALTER TABLE "resellers" ADD COLUMN "brandName" TEXT;
ALTER TABLE "resellers" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "resellers" ADD COLUMN "primaryColor" TEXT;
