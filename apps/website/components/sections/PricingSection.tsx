'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useLang } from '@/lib/i18n';

export function PricingSection() {
  const { t } = useLang();

  return (
    <section id="pricing" className="relative py-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[30rem] w-[46rem] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader badge={t.pricing.badge} title={t.pricing.title} subtitle={t.pricing.subtitle} />

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6 }}
          className="mt-14 mx-auto max-w-3xl"
        >
          <div className="relative rounded-3xl p-[1.5px] bg-gradient-brand shadow-2xl shadow-indigo-500/20">
            <div className="rounded-3xl bg-surface p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-3.5 py-1 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t.pricing.planName}
                  </div>
                  <p className="mt-3 text-sm text-text-muted max-w-xs">{t.pricing.planDesc}</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="flex items-baseline sm:justify-end gap-1">
                    <span className="text-5xl font-bold gradient-text">€70</span>
                    <span className="text-text-muted text-lg">{t.pricing.perMonth}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {t.pricing.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-5 w-5 shrink-0 text-success mt-[1px]" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="mt-9">
                <a href="/pricing">
                  <Button size="lg" className="w-full">
                    {t.pricing.cta} — €70{t.pricing.perMonth}
                  </Button>
                </a>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-text-muted">
                  <span>✓ {t.pricing.note1}</span>
                  <span>✓ {t.pricing.note2}</span>
                  <span>✓ {t.pricing.note3}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
