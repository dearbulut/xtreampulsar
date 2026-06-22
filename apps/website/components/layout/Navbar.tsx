'use client';

import { useState, useEffect } from 'react';
import { Menu, X, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';

const NAV_LINKS = [
  { label: 'Özellikler', href: '#features' },
  { label: 'Karşılaştırma', href: '#comparison' },
  { label: 'Fiyatlar', href: '#pricing' },
  { label: 'Migration', href: '#migration' },
  { label: 'Dokümantasyon', href: 'https://docs.xtreampulsar.io' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={clsx(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-border bg-background/80 backdrop-blur-xl shadow-lg shadow-black/20'
            : 'bg-transparent',
        )}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 animate-pulse-slow" />
              <Zap className="relative w-5 h-5 text-white" fill="currentColor" />
            </div>
            <span className="font-bold text-lg tracking-tight text-text-base group-hover:text-primary transition-colors">
              Xtream<span className="text-primary">Pulsar</span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm text-text-muted hover:text-text-base rounded-lg hover:bg-surface-2 transition-all duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <a href="#pricing" className="text-sm text-text-muted hover:text-text-base transition-colors">
              Giriş yap
            </a>
            <a href="#pricing">
              <Button size="sm">Ücretsiz Dene</Button>
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-text-muted hover:text-text-base rounded-lg hover:bg-surface-2 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menü"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
      </header>

      {/* Mobile menu */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-background/95 backdrop-blur-xl md:hidden transition-all duration-300',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="pt-20 px-6 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="py-3 px-4 text-lg text-text-base hover:text-primary rounded-xl hover:bg-surface-2 transition-all"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
            <Button variant="outline" size="lg" className="w-full" onClick={() => setMobileOpen(false)}>
              Giriş Yap
            </Button>
            <Button size="lg" className="w-full" onClick={() => setMobileOpen(false)}>
              Ücretsiz Dene →
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
