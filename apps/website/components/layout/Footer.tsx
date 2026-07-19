'use client';

import { Zap } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export function Footer() {
  const { t } = useLang();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand">
                <Zap className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Xtream<span className="gradient-text">Pulsar</span>
              </span>
            </a>
            <p className="text-sm text-text-muted max-w-sm leading-relaxed">{t.footer.tagline}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">{t.footer.product}</h4>
            <ul className="space-y-2.5 text-sm text-text-muted">
              <li><a href="#features" className="hover:text-text-base transition-colors">{t.nav.features}</a></li>
              <li><a href="#pricing" className="hover:text-text-base transition-colors">{t.nav.pricing}</a></li>
              <li><a href="#migration" className="hover:text-text-base transition-colors">{t.nav.migration}</a></li>
              <li><a href="#faq" className="hover:text-text-base transition-colors">{t.nav.faq}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">{t.footer.resources}</h4>
            <ul className="space-y-2.5 text-sm text-text-muted">
              <li><a href="https://docs.xtreampulsar.com" target="_blank" rel="noreferrer" className="hover:text-text-base transition-colors">{t.footer.docs}</a></li>
              <li><a href="mailto:info@xtreampulsar.com" className="hover:text-text-base transition-colors">{t.footer.contact}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <span>© {year} XtreamPulsar. {t.footer.rights}</span>
          <span className="font-mono">panel.xtreampulsar.com</span>
        </div>
      </div>
    </footer>
  );
}
