'use client';

import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { useLang } from '@/lib/i18n';

export function StatsSection() {
  const { t } = useLang();

  const stats = [
    { value: <AnimatedCounter target={99.9} suffix="%" />, label: t.stats.uptime, raw: false },
    { value: <AnimatedCounter target={5} />, label: t.stats.install, raw: false },
    { value: <AnimatedCounter target={100} suffix="%" />, label: t.stats.compat, raw: false },
    { value: <span>{t.stats.supportValue}</span>, label: t.stats.support, raw: true },
  ];

  return (
    <section className="relative border-y border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl lg:text-4xl font-bold gradient-text tabular-nums">{s.value}</div>
              <div className="mt-1.5 text-sm text-text-muted">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
