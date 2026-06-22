'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function CTASection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-purple-600/10 rounded-full blur-2xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="space-y-6"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <Zap className="w-8 h-8 text-white" fill="currentColor" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight">
            Bugün{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Başlayın
            </span>
          </h2>

          <p className="text-lg text-text-muted leading-relaxed">
            30 gün ücretsiz. Kredi kartı gerekmez. 5 dakikada kurulum.
            <br />
            Beğenmezseniz tek tık ile iptal.
          </p>

          {/* Email form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourdomain.com"
                required
                className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-text-base placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <Button type="submit" size="md" className="flex-shrink-0 whitespace-nowrap">
                Ücretsiz Dene
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto px-6 py-4 bg-success/10 border border-success/30 rounded-xl text-success text-sm font-medium"
            >
              ✓ Harika! Lisans bilgilerini email ile gönderdik.
            </motion.div>
          )}

          {/* Already have account */}
          <p className="text-sm text-text-muted">
            Zaten hesabın var mı?{' '}
            <a href="/login" className="text-primary hover:text-primary/80 transition-colors font-medium">
              Giriş yap →
            </a>
          </p>

          {/* Trust */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-text-muted pt-2">
            <span>🔒 256-bit SSL şifreleme</span>
            <span>✓ GDPR & KVKK uyumlu</span>
            <span>⚡ 99.9% uptime SLA</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
