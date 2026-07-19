'use client';

import { motion } from 'framer-motion';
import { UploadCloud, Eye, Rocket } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useLang } from '@/lib/i18n';

const ICONS = [UploadCloud, Eye, Rocket];

export function MigrationSection() {
  const { t } = useLang();

  return (
    <section id="migration" className="relative py-24 bg-surface/30 border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader badge={t.migration.badge} title={t.migration.title} subtitle={t.migration.subtitle} />

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {t.migration.steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative rounded-2xl border border-border bg-surface p-7"
              >
                <div className="absolute -top-4 left-7 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
                  {i + 1}
                </div>
                <div className="mt-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-text-muted leading-relaxed">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
