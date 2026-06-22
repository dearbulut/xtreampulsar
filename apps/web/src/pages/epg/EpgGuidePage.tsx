import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

interface Programme {
  id: string;
  start: string;
  stop: string;
  title: string;
  description: string;
  durationMin: number;
}

interface ChannelGuide {
  channelId: string;
  channelName: string;
  tvgId: string;
  programmes: Programme[];
}

const PIXELS_PER_MIN = 3;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function useEpgGuide(date: string) {
  return useQuery<ChannelGuide[]>({
    queryKey: ['epg-guide', date],
    queryFn: async () => {
      const res = await api.get<{ data: ChannelGuide[] }>(`/epg/guide?date=${date}`);
      return res.data.data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

function nowOffsetMin(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function EpgGuidePage() {
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [tooltip, setTooltip] = useState<{ prog: Programme; x: number; y: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isToday = date === toDateStr(new Date());

  const { data: channels = [], isLoading } = useEpgGuide(date);

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(toDateStr(d));
  };

  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(toDateStr(d));
  };

  const totalWidth = 24 * 60 * PIXELS_PER_MIN;

  const progLeft = (prog: Programme) => {
    const start = new Date(prog.start);
    return (start.getHours() * 60 + start.getMinutes()) * PIXELS_PER_MIN;
  };

  const progWidth = (prog: Programme) => Math.max(prog.durationMin * PIXELS_PER_MIN, 40);

  const nowOffset = nowOffsetMin() * PIXELS_PER_MIN;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Program Rehberi</h1>
          <p className="text-sm text-muted mt-0.5">EPG zaman çizelgesi</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="btn btn-secondary p-2">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input text-sm px-3 py-1.5"
          />
          <button onClick={nextDay} className="btn btn-secondary p-2">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="card p-12 text-center text-muted">Yükleniyor…</div>
      )}

      {!isLoading && channels.length === 0 && (
        <div className="card p-12 text-center text-muted">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
          Bu tarih için EPG verisi yok
        </div>
      )}

      {channels.length > 0 && (
        <div className="card overflow-hidden">
          {/* Time header */}
          <div className="flex border-b border-border sticky top-0 bg-surface z-10">
            <div className="w-40 flex-shrink-0 border-r border-border p-3 text-xs text-muted font-semibold">Kanal</div>
            <div className="overflow-x-auto flex-1" ref={timelineRef}>
              <div className="flex relative" style={{ width: totalWidth }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-shrink-0 text-xs text-muted border-r border-border/30 px-2 py-3"
                    style={{ width: 60 * PIXELS_PER_MIN }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Channel rows */}
          <div className="overflow-y-auto max-h-[60vh]">
            {channels.map((ch) => (
              <div key={ch.channelId} className="flex border-b border-border/20 hover:bg-surface-2/30 transition-colors">
                {/* Channel label */}
                <div className="w-40 flex-shrink-0 border-r border-border p-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                    {ch.channelName[0]}
                  </div>
                  <span className="text-xs text-slate-300 truncate">{ch.channelName}</span>
                </div>

                {/* Timeline */}
                <div className="relative overflow-hidden flex-1" style={{ height: 44 }}>
                  <div className="relative h-full" style={{ width: totalWidth }}>
                    {/* Now indicator */}
                    {isToday && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-danger z-20"
                        style={{ left: nowOffset }}
                      />
                    )}

                    {/* Programme blocks */}
                    {ch.programmes.map((prog) => {
                      const now = new Date();
                      const start = new Date(prog.start);
                      const stop = new Date(prog.stop);
                      const isCurrent = isToday && start <= now && now < stop;

                      return (
                        <div
                          key={prog.id}
                          onMouseEnter={(e) => setTooltip({ prog, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                          className={cn(
                            'absolute top-1 bottom-1 rounded-md text-xs px-2 flex items-center overflow-hidden cursor-default border transition-colors',
                            isCurrent
                              ? 'bg-primary/30 border-primary/60 text-slate-100'
                              : 'bg-surface-2 border-border/30 text-muted hover:bg-surface-2/80',
                          )}
                          style={{
                            left: progLeft(prog),
                            width: progWidth(prog) - 2,
                          }}
                        >
                          <span className="truncate">{prog.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-surface border border-border rounded-xl shadow-2xl p-3 max-w-xs pointer-events-none"
          style={{ left: Math.min(tooltip.x + 12, window.innerWidth - 300), top: tooltip.y - 80 }}
        >
          <div className="text-sm font-semibold text-slate-100 mb-1">{tooltip.prog.title}</div>
          <div className="text-xs text-muted mb-1.5">
            {new Date(tooltip.prog.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            {' → '}
            {new Date(tooltip.prog.stop).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            {' • '}
            {tooltip.prog.durationMin} dk
          </div>
          {tooltip.prog.description && (
            <div className="text-xs text-muted line-clamp-3">{tooltip.prog.description}</div>
          )}
        </div>
      )}
    </div>
  );
}
