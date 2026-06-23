-- AlterTable: make email nullable on resellers
ALTER TABLE "resellers" ALTER COLUMN "email" DROP NOT NULL;
