'use client';

import { XCircle } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useLang } from '@/lib/i18n';

export default function CancelPage() {
  const { t } = useLang();
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10">
            <XCircle className="h-8 w-8 text-danger" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">{t.checkout.cancelTitle}</h1>
          <p className="mt-3 text-sm text-text-muted leading-relaxed">{t.checkout.cancelDesc}</p>
          <a href="/pricing" className="mt-8 inline-block">
            <Button>{t.checkout.cancelRetry}</Button>
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
