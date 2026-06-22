'use client';

import { motion } from 'framer-motion';
import { Check, X, AlertTriangle } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { clsx } from 'clsx';

type CellValue = true | false | 'partial' | string;

interface Feature {
  label: string;
  xp: CellValue;
  xm: CellValue;
  xui: CellValue;
  xui_old: CellValue;
}

const FEATURES: Feature[] = [
  { label: 'Fiyat',             xp: '€39/ay',    xm: 'Gizli',    xui: '£80+/ay', xui_old: 'Ücretsiz' },
  { label: 'Ubuntu 22/24',      xp: true,         xm: true,       xui: 'partial', xui_old: false },
  { label: 'Modern UI',         xp: true,         xm: false,      xui: 'partial', xui_old: false },
  { label: 'Gerçek Destek',     xp: true,         xm: false,      xui: false,     xui_old: false },
  { label: 'Tek Tık Migration', xp: true,         xm: 'partial',  xui: false,     xui_old: false },
  { label: 'Realtime Dashboard',xp: true,         xm: false,      xui: false,     xui_old: false },
  { label: 'EPG Otomasyonu',    xp: true,         xm: true,       xui: 'partial', xui_old: false },
  { label: 'Token Auth',        xp: true,         xm: true,       xui: false,     xui_old: false },
  { label: 'Cloud Backup',      xp: true,         xm: true,       xui: false,     xui_old: false },
  { label: 'REST API',          xp: true,         xm: false,      xui: false,     xui_old: false },
  { label: 'Point TV Entegrasyon', xp: true,      xm: false,      xui: false,     xui_old: false },
  { label: 'White-label',       xp: true,         xm: false,      xui: false,     xui_old: false },
];

function Cell({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (value === true) return (
    <div className="flex justify-center">
      <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center', highlight ? 'bg-emerald-500/20' : 'bg-emerald-500/10')}>
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      </div>
    </div>
  );
  if (value === false) return (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
        <X className="w-3.5 h-3.5 text-red-400/70" />
      </div>
    </div>
  );
  if (value === 'partial') return (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400/80" />
      </div>
    </div>
  );
  return <span className={clsx('text-xs font-medium text-center block', highlight ? 'text-indigo-300' : 'text-text-muted')}>{value}</span>;
}

const COLUMNS = [
  { key: 'xp' as const,      label: 'XtreamPulsar', highlight: true },
  { key: 'xm' as const,      label: 'Xtream-Masters', highlight: false },
  { key: 'xui' as const,     label: 'XUI.ONE', highlight: false },
  { key: 'xui_old' as const, label: 'XtreamUI', highlight: false },
];

export function ComparisonSection() {
  return (
    <section id="comparison" className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SectionHeader
            badge="Karşılaştırma"
            title={<>Neden <span className="gradient-text">XtreamPulsar</span>?</>}
            subtitle="Rakiplerimizle yan yana karşılaştırın. Sayılar kendi kendine konuşsun."
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 overflow-x-auto"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-4 text-sm text-text-muted font-medium w-48 sticky left-0 bg-surface/95 backdrop-blur-sm z-10">
                  Özellik
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={clsx(
                      'px-4 py-4 text-center text-sm font-semibold min-w-[140px]',
                      col.highlight
                        ? 'text-indigo-300 bg-indigo-500/10 border-x border-indigo-500/30 rounded-t-xl'
                        : 'text-text-muted',
                    )}
                  >
                    {col.highlight && (
                      <div className="text-[10px] text-indigo-400 font-medium mb-1 bg-indigo-500/20 rounded-full px-2 py-0.5 inline-block">
                        ★ ÖNERİLEN
                      </div>
                    )}
                    <div>{col.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature, i) => (
                <tr
                  key={feature.label}
                  className={clsx('border-b border-border/50 transition-colors hover:bg-surface-2/50', i % 2 === 0 ? '' : 'bg-surface/20')}
                >
                  <td className="px-4 py-3.5 text-sm text-text-muted font-medium sticky left-0 bg-background/80 backdrop-blur-sm z-10">
                    {feature.label}
                  </td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-4 py-3.5 text-center',
                        col.highlight && 'bg-indigo-500/5 border-x border-indigo-500/20',
                      )}
                    >
                      <Cell value={feature[col.key]} highlight={col.highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <p className="mt-4 text-xs text-text-muted text-center">
          ✅ = Tam destek  ⚠️ = Kısmi destek  ❌ = Desteklenmiyor. Veriler kamuya açık bilgilere dayanmaktadır.
        </p>
      </div>
    </section>
  );
}
