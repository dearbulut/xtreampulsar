'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Lock } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useLang } from '@/lib/i18n';

const LICENSE_URL = process.env.NEXT_PUBLIC_LICENSE_URL ?? 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';
const TIER = 'PRO'; // tek paket — license sunucusundaki Stripe fiyatı €70/ay olarak yapılandırılır

export default function PricingPage() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError(t.checkout.emailError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${LICENSE_URL}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: TIER,
          email,
          successUrl: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${SITE_URL}/cancel`,
        }),
      });
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setError(t.checkout.genericError);
    } catch {
      setError(t.checkout.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-32 pb-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 h-[24rem] w-[40rem] rounded-full bg-primary/10 blur-[130px]" />
          <div className="absolute inset-0 mesh-bg" />
        </div>

        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-balance">{t.checkout.title}</h1>
            <p className="mt-3 text-text-muted">{t.checkout.subtitle}</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-10 rounded-3xl p-[1.5px] bg-gradient-brand shadow-2xl shadow-indigo-500/20"
          >
            <div className="rounded-3xl bg-surface p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/25 px-3.5 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.pricing.planName}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold gradient-text">€70</span>
                  <span className="text-text-muted">{t.pricing.perMonth}</span>
                </div>
              </div>

              <div className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {t.pricing.features.slice(0, 10).map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-success mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-3">
                <input
                  type="email"
                  placeholder={t.checkout.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
                />
                {error && <p className="text-danger text-sm">{error}</p>}
                <Button size="lg" className="w-full" disabled={loading} onClick={() => void handleCheckout()}>
                  {loading ? t.checkout.redirecting : t.checkout.buy}
                </Button>
              </div>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <Lock className="h-3.5 w-3.5" />
                {t.checkout.stripeNote}
              </p>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
