'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';

const FAQS = [
  {
    q: 'XtreamPulsar hangi IPTV protokollerini destekliyor?',
    a: 'XtreamPulsar, Xtream Codes API (tam uyumlu), HLS, RTMP ve HTTP protokollerini destekler. Mevcut Mag, Formuler ve diğer IPTV cihazlarıyla çalışmaya hazırdır.',
  },
  {
    q: 'Kaç kullanıcıya kadar ölçeklenebilir?',
    a: 'Business ve White-label planlarında kullanıcı sayısı sınırsızdır. Starter planında 500, Pro planında 5.000 eşzamanlı kullanıcıya kadar destek sunulur. Yük dengeleme ve çoklu sunucu desteği ile ihtiyaçlarınıza göre ölçeklenebilirsiniz.',
  },
  {
    q: 'Mevcut sistemimden geçiş yapabilir miyim?',
    a: 'Evet! XtreamPulsar, XtreamCodes, WHMCS ve diğer popüler panel sistemlerinden M3U ve API bazlı içerik aktarımını destekler. Migration rehberimizle adım adım geçiş yapabilirsiniz.',
  },
  {
    q: 'Reseller sistemi nasıl çalışıyor?',
    a: 'Reseller\'larınıza kredi tanımlayarak kullanıcı oluşturma yetkisi verebilirsiniz. Her reseller kendi paneli üzerinden kullanıcılarını yönetebilir. BASIC, SILVER, GOLD ve PLATINUM tier seçenekleri mevcuttur.',
  },
  {
    q: 'EPG (Elektronik Program Rehberi) desteği var mı?',
    a: 'Evet, birden fazla XMLTV kaynağını ekleyebilirsiniz. Otomatik güncelleme, kanal eşleştirme ve TMDB metadata entegrasyonu dahildir.',
  },
  {
    q: 'Güvenlik özellikleri neler?',
    a: 'Token tabanlı URL doğrulama, IP kısıtlama, VPN/proxy engelleme, coğrafi engelleme, anti-paylaşım sistemi ve brute force koruması standart olarak gelir. Güvenlik modülü üzerinden tüm ayarları özelleştirebilirsiniz.',
  },
  {
    q: '7/24 teknik destek sunuyor musunuz?',
    a: 'Pro planından itibaren 4 saatlik yanıt garantisi ile e-posta ve ticket desteği sunulur. Business ve White-label planlarında ise telefon desteği ve öncelikli destek kuyruğu dahildir.',
  },
  {
    q: 'Kendi sunucuma kurabilir miyim?',
    a: 'Evet! XtreamPulsar self-hosted bir çözümdür. Docker tabanlı kurulum ile Ubuntu/Debian üzerinde dakikalar içinde kurulum yapabilirsiniz. Tek tıkla güncelleme de desteklenir.',
  },
  {
    q: 'Ücretsiz deneme süresi var mı?',
    a: '30 günlük ücretsiz deneme sunuyoruz. Kredi kartı gerekmez. Deneme süresinde tüm özellikler aktif olarak kullanılabilir.',
  },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 relative" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <SectionHeader
          badge="SSS"
          title="Sık Sorulan Sorular"
          subtitle="Aklınızdaki tüm soruların yanıtları burada. Cevap bulamazsanız destek ekibimizle iletişime geçin."
        />

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
              >
                <span className="font-medium text-gray-100 text-sm leading-snug">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed border-t border-gray-800/50 pt-3">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">
            Daha fazla sorunuz mu var?{' '}
            <a href="mailto:support@xtreampulsar.io" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Destek ekibimize yazın →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
