'use client';

import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

const STATS = [
  {
    prefix: '',
    value: 12700,
    suffix: '+',
    label: 'Satır Kod',
    desc: 'Production-ready, TypeScript ile yazılmış',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    prefix: '%',
    value: 100,
    suffix: '',
    label: 'Xtream Codes Uyumlu',
    desc: 'Tüm oynatıcılar sorunsuz çalışır',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    prefix: '',
    value: 30,
    suffix: ' dk',
    label: 'Ortalama Kurulum Süresi',
    desc: 'Tek komutla, sıfır konfigürasyon',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    prefix: '€',
    value: 39,
    suffix: '',
    label: '/Aydan Başlayan Fiyat',
    desc: 'Şeffaf fiyatlandırma, gizli ücret yok',
    color: 'from-orange-500 to-amber-500',
  },
];

export function StatsSection() {
  return (
    <section className="py-20 border-y border-border bg-surface/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-surface p-8 flex flex-col items-center text-center"
            >
              <div className={`text-4xl lg:text-5xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                <AnimatedCounter
                  prefix={stat.prefix}
                  target={stat.value}
                  suffix={stat.suffix}
                  duration={1800}
                />
              </div>
              <p className="text-sm font-semibold text-text-base mb-1">{stat.label}</p>
              <p className="text-xs text-text-muted leading-relaxed">{stat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
