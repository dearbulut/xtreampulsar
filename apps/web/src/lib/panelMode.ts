// White-label hostname gating: aynı SPA, hangi adresten açıldığına göre panel modu.
// admin  → ana panel (tüm rotalar)
// reseller → yalnız /reseller/* (admin ve client rotaları erişilemez)
// client → yalnız /client/* (admin ve reseller rotaları erişilemez)
export type PanelMode = 'admin' | 'reseller' | 'client';

let mode: PanelMode = 'admin';

const CACHE_KEY = 'xp-panel-hosts';

/** Hostname + host eşlemesinden modu hesaplar. */
export function computePanelMode(hosts: { resellerHost?: string | null; clientHost?: string | null }): PanelMode {
  const host = (window.location.hostname || '').toLowerCase();
  const rh = (hosts.resellerHost || '').toLowerCase().trim();
  const ch = (hosts.clientHost || '').toLowerCase().trim();
  if (rh && host === rh) return 'reseller';
  if (ch && host === ch) return 'client';
  return 'admin';
}

export function setPanelMode(m: PanelMode): void {
  mode = m;
}

export function getPanelMode(): PanelMode {
  return mode;
}

/** İlk boyama öncesi flash'ı önlemek için son bilinen host eşlemesini cache'ler. */
export function cachePanelHosts(hosts: { resellerHost?: string | null; clientHost?: string | null }): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ resellerHost: hosts.resellerHost ?? '', clientHost: hosts.clientHost ?? '' }));
  } catch {
    /* ignore */
  }
}

export function readCachedPanelHosts(): { resellerHost?: string | null; clientHost?: string | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as { resellerHost?: string | null; clientHost?: string | null };
  } catch {
    /* ignore */
  }
  return {};
}
