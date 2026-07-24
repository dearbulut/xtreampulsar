-- Roadmap D: Granuler RBAC — yonetici izin gruplari + izin matrisi
CREATE TABLE "admin_groups" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isAdmin"     BOOLEAN NOT NULL DEFAULT false,
  "isReseller"  BOOLEAN NOT NULL DEFAULT false,
  "isBanned"    BOOLEAN NOT NULL DEFAULT false,
  "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_groups_name_key" ON "admin_groups"("name");

ALTER TABLE "users" ADD COLUMN "adminGroupId" TEXT;
CREATE INDEX "users_adminGroupId_idx" ON "users"("adminGroupId");
ALTER TABLE "users" ADD CONSTRAINT "users_adminGroupId_fkey"
  FOREIGN KEY ("adminGroupId") REFERENCES "admin_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cekirdek sistem gruplari
INSERT INTO "admin_groups" ("id","name","description","isAdmin","isReseller","isBanned","permissions","isSystem","updatedAt")
VALUES
  ('grp_superadmin','Super Admin','Tam yetkili yonetici',true,false,false,ARRAY[]::TEXT[],true,CURRENT_TIMESTAMP),
  ('grp_reseller','Bayi','Standart bayi yetkileri',false,true,false,
     ARRAY['users.view','users.create','users.edit','users.extend','streams.view','vod.view','epg.view','reports.view']::TEXT[],
     true,CURRENT_TIMESTAMP),
  ('grp_banned','Engelli','Erisim engelli',false,false,true,ARRAY[]::TEXT[],true,CURRENT_TIMESTAMP);
