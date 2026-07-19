import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/i18n';
import { computePanelMode, setPanelMode, cachePanelHosts, readCachedPanelHosts } from '@/lib/panelMode';

// Synchronously apply saved theme before first paint to prevent flash
try {
  const stored = localStorage.getItem('xp-ui');
  if (stored) {
    const parsed = JSON.parse(stored) as { state?: { theme?: string } };
    if (parsed?.state?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }
} catch {
  // ignore malformed storage
}

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// White-label hostname gating: panel modunu boyamadan ÖNCE belirle.
// 1) Cache'ten hızlı (flash yok), 2) taze public config ile doğrula.
setPanelMode(computePanelMode(readCachedPanelHosts()));

void (async () => {
  try {
    const res = await fetch('/api/v1/settings/public', { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const json = (await res.json()) as { data?: { resellerHost?: string | null; clientHost?: string | null } };
      const hosts = json.data ?? {};
      cachePanelHosts(hosts);
      setPanelMode(computePanelMode(hosts));
    }
  } catch {
    /* ağ hatası → admin varsayılan */
  } finally {
    render();
  }
})();
