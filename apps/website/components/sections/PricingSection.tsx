'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { clsx } from 'clsx';

interface Plan {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  highlight: boolean;
  badge?: string;
  cta: string;
  color: string;
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    monthlyPrice: 39,
    yearlyPrice: 31,
    description: 'Küçük ölçekli operatörler için mükemmel başlangıç.',
    features: [
      '500 eşzamanlı kullanıcı',
      '2 sunucu',
      'Temel analytics',
      'Email destek',
      'Xtream API uyumluluk',
      '30 gün ücretsiz deneme',
    ],
    highlight: false,
    cta: 'Ücretsiz Başla',
    color: 'text-blue-400',
  },
  {
    name: 'Pro',
    monthlyPrice: 79,
    yearlyPrice: 63,
    description: 'Büyüyen operatörler için ihtiyaç duydukları her şey.',
    features: [
      '5.000 eşzamanlı kullanıcı',
      '10 sunucu',
      'Gelişmiş analytics + EPG',
      'Reseller sistemi',
      'Öncelikli destek (4 saat)',
      'Token URL auth',
      'Otomatik failover',
    ],
    highlight: true,
    badge: 'En Popüler',
    cta: 'Pro\'ya Başla',
    color: 'text-indigo-400',
  },
  {
    name: 'Business',
    monthlyPrice: 149,
    yearlyPrice: 119,
    description: 'Büyük ölçekli operasyonlar için sınırsız güç.',
    features: [
      'Sınırsız kullanıcı',
      'Sınırsız sunucu',
      'Tam analitik paketi',
      'White-label hazırlık',
      'Telefon desteği',
      'Cloud backup',
      'SLA garantisi',
    ],
    highlight: false,
    cta: 'Business\'a Başla',
    color: 'text-purple-400',
  },
  {
    name: 'White-label',
    monthlyPrice: 299,
    yearlyPrice: 239,
    description: 'Kendi markanızla satmak isteyenler için.',
    features: [
      'Business\'ın tüm özellikleri',
      'Özel marka / logo',
      'Custom domain panel',
      'Dedicated destek ekibi',
      '%99.95 SLA',
      'Özel geliştirme desteği',
      'Priority server pool',
    ],
    highlight: false,
    cta: 'İletişime Geç',
    color: 'text-cyan-400',
  },
];

export function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-24 bg-surface/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SectionHeader
            badge="Fiyatlandırma"
            title={<><span className="gradient-text">Şeffaf</span> Fiyatlandırma</>}
            subtitle="Gizli ücret yok. İstediğin zaman iptal et. 30 gün ücretsiz dene, beğenmezsen para iade."
          />
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <span className={clsx('text-sm font-medium transition-colors', !yearly ? 'text-text-base' : 'text-text-muted')}>
            Aylık
          </span>
          <button
            onClick={() => setYearly((y) => !y)}
            className={clsx(
              'relative w-12 h-6 rounded-full border transition-all duration-300',
              yearly ? 'bg-primary border-primary' : 'bg-surface-2 border-border',
            )}
            aria-checked={yearly}
            role="switch"
          >
            <span
              className={clsx(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-sm',
                yearly ? 'translate-x-6' : 'translate-x-0',
              )}
            />
          </button>
          <span className={clsx('text-sm font-medium flex items-center gap-2 transition-colors', yearly ? 'text-text-base' : 'text-text-muted')}>
            Yıllık
            <Badge variant="success" className="text-[10px] px-2 py-0.5">%20 indirim</Badge>
          </span>
        </motion.div>

        {/* Plan cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={clsx(
                'relative flex flex-col rounded-2xl border p-6 transition-all duration-300',
                plan.highlight
                  ? 'border-primary/60 bg-indigo-500/5 shadow-lg shadow-indigo-500/10 scale-[1.02]'
                  : 'border-border bg-surface hover:border-border/80 hover:-translate-y-1',
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary text-white shadow-lg shadow-primary/30">
                    <Zap className="w-3 h-3" fill="currentColor" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className={clsx('text-sm font-semibold mb-1', plan.color)}>{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-text-base">
                    €{yearly ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-text-muted text-sm">/ay</span>
                </div>
                {yearly && (
                  <p className="text-xs text-success mt-1">
                    Yıllık €{plan.yearlyPrice * 12} — €{(plan.monthlyPrice - plan.yearlyPrice) * 12} tasarruf
                  </p>
                )}
                <p className="text-xs text-text-muted mt-2 leading-relaxed">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-text-muted">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlight ? 'primary' : 'outline'}
                size="md"
                className="w-full"
                onClick={() => window.location.href = `/pricing`}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 text-center text-sm text-text-muted"
        >
          30 gün ücretsiz deneme · Kredi kartı gerekmez · İstediğin zaman iptal et
        </motion.p>
      </div>
    </section>
  );
}
