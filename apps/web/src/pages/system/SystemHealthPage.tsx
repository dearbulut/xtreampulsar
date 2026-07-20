import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, MemoryStick, HardDrive, Save, Play, Activity, Bell } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useMonitorStatus,
  useMonitorConfig,
  useUpdateMonitorConfig,
  useRunMonitorCheck,
  type MonitorConfig,
} from '@/hooks/useSystemMonitor';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

function fmtUptime(secs: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return t('system.uptimeDH', { d, h });
  if (h > 0) return t('system.uptimeHM', { h, m });
  return t('system.uptimeM', { m });
}

function Gauge({ icon: Icon, label, value, threshold, sub }: { icon: typeof Cpu; label: string; value: number; threshold: number; sub?: string }) {
  const over = value >= threshold;
  const warn = value >= threshold * 0.85;
  const color = over ? 'bg-danger' : warn ? 'bg-warning' : 'bg-success';
  const text = over ? 'text-danger' : warn ? 'text-warning' : 'text-success';
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm text-muted"><Icon className="w-4 h-4" /> {label}</div>
        <span className={cn('text-2xl font-bold tabular-nums', text)}>{value}%</span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      {sub && <div className="text-xs text-muted mt-2">{sub}</div>}
    </div>
  );
}

export function SystemHealthPage() {
  const { t } = useTranslation();
  const { data: status } = useMonitorStatus();
  const { data: cfg } = useMonitorConfig();
  const update = useUpdateMonitorConfig();
  const run = useRunMonitorCheck();
  const [form, setForm] = useState<MonitorConfig | null>(null);
  useEffect(() => { if (cfg && !form) setForm(cfg); }, [cfg, form]);

  const num = (k: keyof MonitorConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)) } : f));

  return (
    <div>
      <PageHeader title={t('system.title')} description={t('system.subtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Gauge icon={Cpu} label={t('system.cpu')} value={status?.cpu ?? 0} threshold={form?.cpuAlertPct ?? 90}
          sub={status ? t('system.cores', { n: status.cores }) + ' · ' + t('system.load') + ' ' + (status.loadAvg[0] ?? 0) : undefined} />
        <Gauge icon={MemoryStick} label={t('system.ram')} value={status?.mem ?? 0} threshold={form?.memAlertPct ?? 90}
          sub={status ? `${status.memUsedMb} / ${status.memTotalMb} MB` : undefined} />
        <Gauge icon={HardDrive} label={t('system.disk')} value={status?.disk ?? 0} threshold={form?.diskAlertPct ?? 90}
          sub={status ? fmtUptime(status.uptimeSecs, t) : undefined} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="w-4 h-4 text-primary" /> {t('system.alertsTitle')}
          </div>
          {form && (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted">{form.enabled ? t('system.on') : t('system.off')}</span>
              <input type="checkbox" className="toggle" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            </label>
          )}
        </div>
        <p className="text-xs text-muted mb-4">{t('system.alertsHint')}</p>
        {form && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">{t('system.cpuThreshold')}</label>
                <input type="number" min={1} max={100} className="input" value={form.cpuAlertPct} onChange={num('cpuAlertPct')} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t('system.memThreshold')}</label>
                <input type="number" min={1} max={100} className="input" value={form.memAlertPct} onChange={num('memAlertPct')} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t('system.diskThreshold')}</label>
                <input type="number" min={1} max={100} className="input" value={form.diskAlertPct} onChange={num('diskAlertPct')} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button className="btn-primary inline-flex items-center gap-1.5" disabled={update.isPending} onClick={() => update.mutate(form)}>
                <Save className="w-3.5 h-3.5" /> {update.isPending ? t('common.loading') : t('common.save')}
              </button>
              <button className="btn-ghost border border-border inline-flex items-center gap-1.5" disabled={run.isPending}
                onClick={() => run.mutate(undefined, {
                  onSuccess: (r) => toast.success(r.alerted.length ? t('system.checkAlerted', { list: r.alerted.join(', ') }) : t('system.checkOk')),
                })}>
                <Play className="w-3.5 h-3.5" /> {run.isPending ? t('common.loading') : t('system.checkNow')}
              </button>
              <span className="text-xs text-muted inline-flex items-center gap-1"><Activity className="w-3 h-3" /> {t('system.autoRefresh')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
