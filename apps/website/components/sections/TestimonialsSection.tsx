'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';

const TESTIMONIALS = [
  {
    name: 'Ahmet K.',
    role: 'IPTV Operatörü, İstanbul',
    avatar: 'AK',
    rating: 5,
    text: 'XtreamPulsar ile yönetim panelimizi tamamen modernize ettik. Özellikle reseller sistemi ve gelişmiş analitik özellikler işimizi çok kolaylaştırdı. Teknik destek de son derece hızlı.',
  },
  {
    name: 'Carlos M.',
    role: 'Streaming Provider, Madrid',
    avatar: 'CM',
    rating: 5,
    text: 'We switched from a legacy panel and the difference is night and day. The Xtream API compatibility meant zero downtime for our 3000+ subscribers during migration.',
  },
  {
    name: 'Mohammed A.',
    role: 'Media Company, Dubai',
    avatar: 'MA',
    rating: 5,
    text: 'The multi-server load balancing and HLS transcoding features are exactly what we needed. Our content delivery quality improved significantly within the first week.',
  },
  {
    name: 'Elena P.',
    role: 'VOD Platform, Athens',
    avatar: 'EP',
    rating: 4,
    text: 'Excellent dashboard with real-time analytics. The EPG integration and automatic metadata fetching saved us hours of manual work every week.',
  },
  {
    name: 'Mehmet Y.',
    role: 'Reseller, Ankara',
    avatar: 'MY',
    rating: 5,
    text: 'Reseller paneli gerçekten kullanışlı. Kredi sistemi ve kullanıcı yönetimi çok akıcı. Müşterilerimize daha iyi hizmet verebiliyoruz artık.',
  },
  {
    name: 'Pierre D.',
    role: 'IPTV Operator, Lyon',
    avatar: 'PD',
    rating: 5,
    text: 'The white-label features allowed us to present a fully branded experience to our clients. Setup was straightforward and the documentation is comprehensive.',
  },
];

const AVATARCOLORS = [
  'from-indigo-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-indigo-500',
];

export function TestimonialsSection() {
  return (
    <section className="py-24 relative overflow-hidden" id="testimonials">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/10 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader
          badge="Müşteriler"
          title="Onlar Söylesin"
          subtitle="Dünya genelinde 500+ IPTV operatörü tarafından kullanılan XtreamPulsar hakkında ne dediklerini okuyun."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6 flex flex-col gap-4 hover:border-indigo-800/50 transition-colors"
            >
              <div className="flex items-center gap-1">
                {Array.from({ length: t.rating }).map((_, si) => (
                  <Star key={si} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                {t.rating < 5 && Array.from({ length: 5 - t.rating }).map((_, si) => (
                  <Star key={si} className="w-4 h-4 text-gray-700" />
                ))}
              </div>

              <p className="text-sm text-gray-300 leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>

              <div className="flex items-center gap-3 border-t border-gray-800 pt-4">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${AVATARCOLORS[i % AVATARCOLORS.length]} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
