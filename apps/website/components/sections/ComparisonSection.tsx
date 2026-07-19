'use client';

import { motion } from 'framer-motion';
import { Check, X, CircleDollarSign, Zap } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useLang } from '@/lib/i18n';

export function ComparisonSection() {
  const { t } = useLang();

  const cell = (v: boolean | string, isUs: boolean) => {
    if (v === true) {
      return (
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${isUs ? 'text-success' : 'text-success/80'}`}>
          <Check className="h-4 w-4" /> {t.comparison.yesLabel}
        </span>
      );
    }
    if (v === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-warning">
          <CircleDollarSign className="h-4 w-4" /> {t.comparison.paidLabel}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
        <X className="h-4 w-4" /> {t.comparison.noLabel}
      </span>
    );
  };

  return (
    <section id="comparison" className="relative py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeader badge={t.comparison.badge} title={t.comparison.title} subtitle={t.comparison.subtitle} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mt-14 overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-6 py-4 text-sm font-semibold text-text-muted">{t.comparison.colFeature}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-text-muted">{t.comparison.colOthers}</th>
                  <th className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 text-sm font-bold">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-brand">
                        <Zap className="h-3.5 w-3.5 text-white" />
                      </span>
                      {t.comparison.colUs}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.comparison.rows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 1 ? 'bg-surface-2/40' : ''}>
                    <td className="px-6 py-3.5 text-sm">{row.label}</td>
                    <td className="px-6 py-3.5">{cell(row.others, false)}</td>
                    <td className="px-6 py-3.5 bg-primary/[0.04]">{cell(row.us, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
