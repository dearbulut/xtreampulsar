import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGeoConnections } from '@/hooks/useDashboard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

/** 2-harfli ülke kodunu bayrak emojisine çevirir (regional indicator). */
function flagEmoji(cc: string): string {
  const chars = [...(cc ?? '').toUpperCase()];
  if (chars.length !== 2 || !chars.every((c) => c >= 'A' && c <= 'Z')) return '\u{1F310}';
  const BASE = 0x1f1e6;
  return String.fromCodePoint(...chars.map((c) => BASE + c.charCodeAt(0) - 65));
}

/** Canlı bağlantıların ülkeye göre dağılımı — bayrak + yatay bar. Açık/koyu uyumlu. */
export function GeoConnectionsCard() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useGeoConnections();

  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...data.map((d) => d.count), 1);
  const top = data.slice(0, 7);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-fg flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          {t('dashboard.onlineByCountry')}
        </h2>
        <span className="text-xs text-muted tabular-nums">
          {total.toLocaleString('tr')} {t('dashboard.online')}
        </span>
      </div>
      <p className="text-xs text-muted mb-4">{t('dashboard.byRegionSubtitle')}</p>

      {isLoading ? (
        <div className="h-52 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : top.length === 0 ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted text-sm">
          <Globe className="w-8 h-8 opacity-40" />
          <span>{t('dashboard.noActiveConnections')}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map((d) => (
            <div key={d.countryCode} className="flex items-center gap-3">
              <span className="text-lg leading-none w-6 text-center">{flagEmoji(d.countryCode)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-fg truncate">{d.country || d.countryCode}</span>
                  <span className="text-xs font-semibold text-fg tabular-nums">
                    {d.count.toLocaleString('tr')}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(6, (d.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
