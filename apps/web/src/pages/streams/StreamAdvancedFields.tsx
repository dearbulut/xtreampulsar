import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, SlidersHorizontal, Clock, CalendarClock } from 'lucide-react';
import { useEPGSources } from '@/hooks/useEPG';

export interface StreamAdvanced {
  directSource: boolean;
  generatePts: boolean;
  allowRecording: boolean;
  allowRtmpOutput: boolean;
  streamUserAgent: string;
  httpProxy: string;
  httpCookie: string;
  httpHeaders: string;
  customFfmpeg: string;
  customMap: string;
  probeSize: string;
  delayMinutes: string;
  transcodeProfile: string;
  restartDays: string[];
  restartTime: string;
  epgSourceId: string;
  epgLang: string;
}

export const EMPTY_ADVANCED: StreamAdvanced = {
  directSource: false, generatePts: true, allowRecording: true, allowRtmpOutput: false,
  streamUserAgent: '', httpProxy: '', httpCookie: '', httpHeaders: '',
  customFfmpeg: '', customMap: '', probeSize: '', delayMinutes: '', transcodeProfile: '',
  restartDays: [], restartTime: '', epgSourceId: '', epgLang: '',
};

/** Bir Stream kaydından Gelişmiş alanları çıkarır (edit formu doldurmak için). */
export function advancedFromStream(r: Record<string, unknown>): StreamAdvanced {
  const str = (v: unknown) => (v == null ? '' : String(v));
  return {
    directSource: !!r.directSource,
    generatePts: r.generatePts !== false,
    allowRecording: r.allowRecording !== false,
    allowRtmpOutput: !!r.allowRtmpOutput,
    streamUserAgent: str(r.streamUserAgent),
    httpProxy: str(r.httpProxy),
    httpCookie: str(r.httpCookie),
    httpHeaders: str(r.httpHeaders),
    customFfmpeg: str(r.customFfmpeg),
    customMap: str(r.customMap),
    probeSize: r.probeSize == null ? '' : String(r.probeSize),
    delayMinutes: r.delayMinutes == null ? '' : String(r.delayMinutes),
    transcodeProfile: str(r.transcodeProfile),
    restartDays: Array.isArray(r.restartDays) ? (r.restartDays as string[]) : [],
    restartTime: str(r.restartTime),
    epgSourceId: str(r.epgSourceId),
    epgLang: str(r.epgLang),
  };
}

/** Gelişmiş alanları API payload'a çevirir (boşları atlar). */
export function advancedToPayload(a: StreamAdvanced): Record<string, unknown> {
  const p: Record<string, unknown> = {
    directSource: a.directSource,
    generatePts: a.generatePts,
    allowRecording: a.allowRecording,
    allowRtmpOutput: a.allowRtmpOutput,
  };
  if (a.streamUserAgent.trim()) p.streamUserAgent = a.streamUserAgent.trim();
  if (a.httpProxy.trim()) p.httpProxy = a.httpProxy.trim();
  if (a.httpCookie.trim()) p.httpCookie = a.httpCookie.trim();
  if (a.httpHeaders.trim()) p.httpHeaders = a.httpHeaders;
  if (a.customFfmpeg.trim()) p.customFfmpeg = a.customFfmpeg.trim();
  if (a.customMap.trim()) p.customMap = a.customMap.trim();
  if (a.probeSize.trim()) p.probeSize = Number(a.probeSize) || 0;
  if (a.delayMinutes.trim()) p.delayMinutes = Number(a.delayMinutes) || 0;
  if (a.transcodeProfile.trim()) p.transcodeProfile = a.transcodeProfile.trim();
  if (a.restartDays.length) p.restartDays = a.restartDays;
  if (a.restartTime.trim()) p.restartTime = a.restartTime.trim();
  if (a.epgSourceId.trim()) p.epgSourceId = a.epgSourceId.trim();
  if (a.epgLang.trim()) p.epgLang = a.epgLang.trim();
  return p;
}

export function StreamAdvancedFields({ value, onChange, defaultOpen = false }: {
  value: StreamAdvanced;
  onChange: (patch: Partial<StreamAdvanced>) => void;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const { data: epgSources = [] } = useEPGSources();
  const [open, setOpen] = useState(defaultOpen);
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const toggleDay = (d: string) => onChange({ restartDays: value.restartDays.includes(d) ? value.restartDays.filter((x) => x !== d) : [...value.restartDays, d] });
  const toggle = (k: keyof StreamAdvanced) => onChange({ [k]: !value[k] } as Partial<StreamAdvanced>);
  const set = (k: keyof StreamAdvanced, v: string) => onChange({ [k]: v } as Partial<StreamAdvanced>);

  return (
    <div className="border-t border-border pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm font-medium text-fg">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <SlidersHorizontal className="w-4 h-4 text-muted" /> {t('streams.advanced')}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {/* Bayraklar */}
          <div className="rounded-xl border border-border bg-surface-2/40 p-3">
            <div className="label mb-2">{t('streams.advFlags')}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
              {([
                ['directSource', 'streams.directSource'],
                ['generatePts', 'streams.generatePts'],
                ['allowRecording', 'streams.allowRecording'],
                ['allowRtmpOutput', 'streams.allowRtmpOutput'],
              ] as const).map(([k, key]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="accent-primary" checked={value[k] as boolean} onChange={() => toggle(k)} />
                  {t(key)}
                </label>
              ))}
            </div>
          </div>

          {/* Bağlantı */}
          <div className="rounded-xl border border-border bg-surface-2/40 p-3">
            <div className="label mb-2">{t('streams.advConnection')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="label">{t('streams.streamUserAgent')}</label>
                <input className="input text-xs" placeholder="VLC/3.0" value={value.streamUserAgent} onChange={(e) => set('streamUserAgent', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('streams.httpProxy')}</label>
                <input className="input font-mono text-xs" placeholder="ip:port" value={value.httpProxy} onChange={(e) => set('httpProxy', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('streams.httpCookie')}</label>
                <input className="input font-mono text-xs" placeholder="key=value;" value={value.httpCookie} onChange={(e) => set('httpCookie', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('streams.probeSize')}</label>
                <input className="input" type="number" min={0} placeholder="128000" value={value.probeSize} onChange={(e) => set('probeSize', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('streams.delayMinutes')}</label>
                <input className="input" type="number" min={0} value={value.delayMinutes} onChange={(e) => set('delayMinutes', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('streams.transcodeProfile')}</label>
                <input className="input" placeholder="copy" value={value.transcodeProfile} onChange={(e) => set('transcodeProfile', e.target.value)} />
              </div>
            </div>
          </div>

          {/* FFmpeg */}
          <div className="rounded-xl border border-border bg-surface-2/40 p-3">
            <div className="label mb-2">{t('streams.advFfmpeg')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{t('streams.customFfmpeg')}</label>
                <input className="input font-mono text-xs" placeholder="-vcodec copy -acodec aac" value={value.customFfmpeg} onChange={(e) => set('customFfmpeg', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('streams.customMap')}</label>
                <input className="input font-mono text-xs" placeholder="-map 0:v:0 -map 0:a:1" value={value.customMap} onChange={(e) => set('customMap', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">{t('streams.httpHeaders')}</label>
                <textarea className="input font-mono text-xs min-h-[54px]" placeholder={'X-Foo: bar\nX-Baz: qux'} value={value.httpHeaders} onChange={(e) => set('httpHeaders', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Alt sıra: Otomatik yeniden başlat + EPG yan yana */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Otomatik yeniden başlat */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="label flex items-center gap-1.5 mb-2"><CalendarClock className="w-3.5 h-3.5" /> {t('streams.autoRestart')}</div>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button type="button" key={d} onClick={() => toggleDay(d)}
                    className={value.restartDays.includes(d) ? 'px-2 py-1 rounded text-[11px] bg-primary text-white' : 'px-2 py-1 rounded text-[11px] bg-surface-2 text-muted'}>
                    {t(`streams.day_${d.slice(0,3).toLowerCase()}`)}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted" />
                <input type="time" className="input w-32" value={value.restartTime} onChange={(e) => set('restartTime', e.target.value)} />
                <span className="text-[11px] text-muted">{t('streams.autoRestartHint')}</span>
              </div>
            </div>

            {/* EPG */}
            <div className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="label mb-2">{t('streams.epg')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('streams.epgSource')}</label>
                  <select className="input" value={value.epgSourceId} onChange={(e) => set('epgSourceId', e.target.value)}>
                    <option value="">{t('streams.epgSourceNone')}</option>
                    {epgSources.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t('streams.epgLang')}</label>
                  <input className="input" placeholder="tr / en" value={value.epgLang} onChange={(e) => set('epgLang', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
