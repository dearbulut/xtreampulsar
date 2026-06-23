-- Add packageId to users table to track which package created the user
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "packageId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_packageId_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_packageId_idx" ON "users"("packageId");
