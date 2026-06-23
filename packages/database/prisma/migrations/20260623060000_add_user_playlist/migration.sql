-- CreateTable
CREATE TABLE "user_playlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'm3u_plus',
    "filters" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastAccessed" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_playlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_playlists_token_key" ON "user_playlists"("token");

-- CreateIndex
CREATE INDEX "user_playlists_userId_idx" ON "user_playlists"("userId");

-- CreateIndex
CREATE INDEX "user_playlists_token_idx" ON "user_playlists"("token");

-- AddForeignKey
ALTER TABLE "user_playlists" ADD CONSTRAINT "user_playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
