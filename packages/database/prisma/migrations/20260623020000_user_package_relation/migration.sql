-- Add packageId to users table to track which package created the user
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "packageId" TEXT;

ALTER TABLE "users"
  ADD CONSTRAINT IF NOT EXISTS "users_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "users_packageId_idx" ON "users"("packageId");
