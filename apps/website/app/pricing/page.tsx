'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const TIERS = [
  { key: 'STARTER', name: 'Starter', price: 39, desc: 'Küçük ölçekli operatörler' },
  { key: 'PRO', name: 'Pro', price: 79, desc: 'Büyüyen operatörler' },
  { key: 'BUSINESS', name: 'Business', price: 149, desc: 'Büyük ölçekli operasyonlar' },
  { key: 'WHITE_LABEL', name: 'White-label', price: 299, desc: 'Tam özelleştirme' },
];

const LICENSE_URL = process.env.NEXT_PUBLIC_LICENSE_URL ?? 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';

export default function PricingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleCheckout = async (tier: string) => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setError('');
    setLoading(tier);
    try {
      const res = await fetch(`${LICENSE_URL}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          email,
          successUrl: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${SITE_URL}/cancel`,
        }),
      });
      const json = await res.json() as { url?: string };
      if (json.url) window.location.href = json.url;
    } catch {
      setError('Bir hata oluştu, lütfen tekrar deneyin.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-2">Planlar & Fiyatlandırma</h1>
          <p className="text-gray-400 text-center mb-10">Lisansınızı almak için e-posta adresinizi girin ve planı seçin.</p>

          <div className="mb-8 flex flex-col items-center gap-2">
            <input
              type="email"
              placeholder="E-posta adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full max-w-sm px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((t) => (
              <div
                key={t.key}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4 hover:border-indigo-600 transition-colors"
              >
                <div>
                  <div className="text-indigo-400 font-semibold text-sm mb-1">{t.name}</div>
                  <div className="text-3xl font-bold">${t.price}<span className="text-base font-normal text-gray-400">/ay</span></div>
                  <div className="text-gray-500 text-sm mt-1">{t.desc}</div>
                </div>
                <button
                  onClick={() => handleCheckout(t.key)}
                  disabled={loading === t.key}
                  className="mt-auto w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition font-medium text-sm"
                >
                  {loading === t.key ? 'Yönlendiriliyor...' : 'Başla →'}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            Ödeme Stripe üzerinden güvenli şekilde işlenir. İptal istediğiniz zaman.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
