'use client';

import { motion } from 'framer-motion';
import {
  Tv, Film, Rocket, RefreshCw, Users, Plug, LayoutDashboard, Bot,
  ShieldCheck, DatabaseBackup, CalendarClock, Palette,
} from 'lucide-react';
import { GlowCard } from '@/components/ui/GlowCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useLang } from '@/lib/i18n';

const ICONS = [Tv, Film, Rocket, RefreshCw, Users, Plug, LayoutDashboard, Bot, ShieldCheck, DatabaseBackup, CalendarClock, Palette];
const COLORS = [
  'text-indigo-400 bg-indigo-500/10', 'text-purple-400 bg-purple-500/10', 'text-cyan-400 bg-cyan-500/10',
  'text-emerald-400 bg-emerald-500/10', 'text-amber-400 bg-amber-500/10', 'text-pink-400 bg-pink-500/10',
  'text-blue-400 bg-blue-500/10', 'text-violet-400 bg-violet-500/10', 'text-red-400 bg-red-500/10',
  'text-teal-400 bg-teal-500/10', 'text-orange-400 bg-orange-500/10', 'text-fuchsia-400 bg-fuchsia-500/10',
];

export function FeaturesSection() {
  const { t } = useLang();

  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader badge={t.features.badge} title={t.features.title} subtitle={t.features.subtitle} />

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.features.items.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.1 }}
              >
                <GlowCard className="h-full rounded-2xl border border-border bg-surface p-6">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${COLORS[i % COLORS.length]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-text-muted leading-relaxed">{item.desc}</p>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
