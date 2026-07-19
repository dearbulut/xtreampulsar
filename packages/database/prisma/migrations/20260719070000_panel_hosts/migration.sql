-- White-label: reseller/client panel için ayrı hostname (admin URL'sini gizlemek)
ALTER TABLE "settings" ADD COLUMN "resellerPanelHost" TEXT;
ALTER TABLE "settings" ADD COLUMN "clientPanelHost" TEXT;
