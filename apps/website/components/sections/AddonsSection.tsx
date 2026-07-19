'use client';

import { motion } from 'framer-motion';
import { LayoutDashboard, RefreshCw, Plug, DatabaseBackup, ShieldCheck, Bot, BadgeCheck } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useLang } from '@/lib/i18n';

const ICONS = [LayoutDashboard, RefreshCw, Plug, DatabaseBackup, ShieldCheck, Bot];

export function AddonsSection() {
  const { t } = useLang();

  return (
    <section id="addons" className="relative py-24 bg-surface/30 border-y border-border overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[24rem] w-[40rem] rounded-full bg-primary/10 blur-[130px]" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader badge={t.addons.badge} title={t.addons.title} subtitle={t.addons.subtitle} />

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.addons.items.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.1 }}
                className="group relative rounded-2xl border border-border bg-surface p-6 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/20 px-2.5 py-1 text-xs font-semibold text-success">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t.addons.included}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted leading-relaxed">{item.desc}</p>
                <p className="mt-3 text-xs text-text-muted/70">
                  <span className="line-through">€€</span> {t.addons.elsewhere}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
