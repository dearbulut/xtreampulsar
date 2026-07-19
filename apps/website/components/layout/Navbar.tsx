'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { useLang, type Lang } from '@/lib/i18n';

export function Navbar() {
  const { t, lang, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: t.nav.features, href: '#features' },
    { label: t.nav.addons, href: '#addons' },
    { label: t.nav.comparison, href: '#comparison' },
    { label: t.nav.migration, href: '#migration' },
    { label: t.nav.pricing, href: '#pricing' },
    { label: t.nav.faq, href: '#faq' },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const LangSwitch = ({ className }: { className?: string }) => (
    <div className={clsx('flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-semibold', className)}>
      {(['tr', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={clsx(
            'px-2.5 py-1 rounded-full uppercase transition-colors',
            lang === l ? 'bg-primary text-white' : 'text-text-muted hover:text-text-base',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={clsx(
        'fixed top-0 inset-x-0 z-50 transition-all duration-300',
        scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-lg shadow-black/20' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
              <Zap className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              Xtream<span className="gradient-text">Pulsar</span>
            </span>
          </a>

          <div className="hidden lg:flex items-center gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm text-text-muted hover:text-text-base rounded-lg hover:bg-surface-2 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <LangSwitch />
            <a href="#pricing">
              <Button size="sm">{t.nav.start}</Button>
            </a>
          </div>

          <button
            className="lg:hidden p-2 text-text-muted hover:text-text-base"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm text-text-muted hover:text-text-base rounded-lg hover:bg-surface-2 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="flex items-center justify-between gap-3 px-3 pt-3 border-t border-border mt-2">
              <LangSwitch />
              <a href="#pricing" onClick={() => setMobileOpen(false)}>
                <Button size="sm">{t.nav.start}</Button>
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
