/**
 * Roadmap D — RBAC izin katalogu.
 * Xtream UI Pro'nun Admin/Reseller Permissions sekmelerine karsilik gelen,
 * kategori-bazli gruplanmis izin anahtarlari. Hem backend guard'i hem de
 * frontend matris editoru bu tek kaynagi kullanir.
 */
export interface PermissionDef {
  key: string;
  labelTr: string;
  labelEn: string;
}
export interface PermissionCategory {
  key: string;
  labelTr: string;
  labelEn: string;
  permissions: PermissionDef[];
}

export const PERMISSION_CATALOG: PermissionCategory[] = [
  {
    key: 'users', labelTr: 'Kullanıcılar', labelEn: 'Users',
    permissions: [
      { key: 'users.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'users.create', labelTr: 'Oluştur', labelEn: 'Create' },
      { key: 'users.edit', labelTr: 'Düzenle', labelEn: 'Edit' },
      { key: 'users.delete', labelTr: 'Sil', labelEn: 'Delete' },
      { key: 'users.extend', labelTr: 'Süre uzat', labelEn: 'Extend' },
      { key: 'users.ban', labelTr: 'Yasakla/Aç', labelEn: 'Ban/Unban' },
      { key: 'users.impersonate', labelTr: 'Kimliğine bürün', labelEn: 'Impersonate' },
    ],
  },
  {
    key: 'resellers', labelTr: 'Bayiler', labelEn: 'Resellers',
    permissions: [
      { key: 'resellers.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'resellers.create', labelTr: 'Oluştur', labelEn: 'Create' },
      { key: 'resellers.edit', labelTr: 'Düzenle', labelEn: 'Edit' },
      { key: 'resellers.delete', labelTr: 'Sil', labelEn: 'Delete' },
      { key: 'resellers.credits', labelTr: 'Kredi yönet', labelEn: 'Manage credits' },
    ],
  },
  {
    key: 'streams', labelTr: 'Yayınlar', labelEn: 'Streams',
    permissions: [
      { key: 'streams.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'streams.create', labelTr: 'Oluştur', labelEn: 'Create' },
      { key: 'streams.edit', labelTr: 'Düzenle', labelEn: 'Edit' },
      { key: 'streams.delete', labelTr: 'Sil', labelEn: 'Delete' },
      { key: 'streams.restart', labelTr: 'Yeniden başlat', labelEn: 'Restart' },
    ],
  },
  {
    key: 'vod', labelTr: 'İçerik (VOD/Dizi)', labelEn: 'Content (VOD/Series)',
    permissions: [
      { key: 'vod.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'vod.manage', labelTr: 'Yönet', labelEn: 'Manage' },
    ],
  },
  {
    key: 'content', labelTr: 'Kategori & Paket', labelEn: 'Categories & Packages',
    permissions: [
      { key: 'bouquets.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'bouquets.manage', labelTr: 'Yönet', labelEn: 'Manage' },
      { key: 'packages.view', labelTr: 'Paket görüntüle', labelEn: 'View packages' },
      { key: 'packages.manage', labelTr: 'Paket yönet', labelEn: 'Manage packages' },
    ],
  },
  {
    key: 'epg', labelTr: 'EPG', labelEn: 'EPG',
    permissions: [
      { key: 'epg.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'epg.manage', labelTr: 'Yönet', labelEn: 'Manage' },
    ],
  },
  {
    key: 'servers', labelTr: 'Sunucular', labelEn: 'Servers',
    permissions: [
      { key: 'servers.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'servers.manage', labelTr: 'Yönet', labelEn: 'Manage' },
    ],
  },
  {
    key: 'security', labelTr: 'Güvenlik', labelEn: 'Security',
    permissions: [
      { key: 'security.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'security.manage', labelTr: 'Yönet', labelEn: 'Manage' },
    ],
  },
  {
    key: 'billing', labelTr: 'Fatura & Mağaza', labelEn: 'Billing & Store',
    permissions: [
      { key: 'billing.view', labelTr: 'Görüntüle', labelEn: 'View' },
      { key: 'billing.manage', labelTr: 'Yönet', labelEn: 'Manage' },
    ],
  },
  {
    key: 'monitoring', labelTr: 'İzleme & Rapor', labelEn: 'Monitoring & Reports',
    permissions: [
      { key: 'reports.view', labelTr: 'Raporları görüntüle', labelEn: 'View reports' },
      { key: 'monitor.view', labelTr: 'Canlı izleme', labelEn: 'Live monitoring' },
      { key: 'audit.view', labelTr: 'Denetim günlüğü', labelEn: 'Audit log' },
    ],
  },
  {
    key: 'system', labelTr: 'Sistem', labelEn: 'System',
    permissions: [
      { key: 'settings.view', labelTr: 'Ayarları görüntüle', labelEn: 'View settings' },
      { key: 'settings.edit', labelTr: 'Ayarları düzenle', labelEn: 'Edit settings' },
      { key: 'backup.view', labelTr: 'Yedek görüntüle', labelEn: 'View backups' },
      { key: 'backup.manage', labelTr: 'Yedek yönet', labelEn: 'Manage backups' },
      { key: 'tools.use', labelTr: 'Araçları kullan', labelEn: 'Use tools' },
      { key: 'groups.manage', labelTr: 'Grupları yönet', labelEn: 'Manage groups' },
    ],
  },
];

/** Tum gecerli izin anahtarlarinin duz listesi. */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((c) =>
  c.permissions.map((p) => p.key),
);

export function isValidPermission(key: string): boolean {
  return ALL_PERMISSION_KEYS.includes(key);
}
