'use client';

import { motion } from 'framer-motion';
import {
  Zap, BarChart3, Shield, RefreshCw, Tv, Users,
  Terminal, Lock, Globe, Cloud, Smartphone, HeadphonesIcon,
} from 'lucide-react';
import { GlowCard } from '@/components/ui/GlowCard';
import { SectionHeader } from '@/components/ui/SectionHeader';

const FEATURES = [
  {
    icon: Zap,
    title: 'Tek Tık Migration',
    desc: 'XtreamUI, XUI.ONE, Xtream-Masters\'dan tek tıkla import. Kullanıcılar, paketler, kanallar — hepsi aktarılır.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: BarChart3,
    title: 'Gerçek Zamanlı Dashboard',
    desc: 'Canlı bant genişliği grafiği, anlık izleyici sayısı, sunucu yükü. Saniyede güncellenen metrikler.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Shield,
    title: 'Server Guard',
    desc: 'DDoS koruması, brute force engeli, ülke bazlı geo-blocking. Paneli dış tehditlere karşı koru.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: RefreshCw,
    title: 'Otomatik Failover',
    desc: 'Primary kaynak çevrimdışı olunca 2 saniye içinde backup\'a geçiş. Kullanıcı hiçbir şey hissetmez.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    icon: Tv,
    title: 'EPG Otomasyonu',
    desc: 'XMLTV kaynak yönetimi, fuzzy-match ile akıllı eşleştirme, toplu atama. EPG bakımı artık dakikalar sürer.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Users,
    title: 'Reseller Sistemi',
    desc: 'Kredi bazlı hiyerarşik bayi yönetimi. Bayileriniz kendi panellerinden kullanıcı oluşturabilir.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
  {
    icon: Terminal,
    title: 'Tek Komut Kurulum',
    desc: '`curl | bash` ile 30 dakikada canlıya alın. Ubuntu 22.04/24.04 destekli, Docker tabanlı.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Lock,
    title: 'Token Auth',
    desc: 'Her stream için benzersiz zaman sınırlı token. Link paylaşımı çalışmaz, torrent engellidir.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Globe,
    title: 'Multi-Server Load Balancer',
    desc: 'Sınırsız load balancer node ekle. Trafik otomatik dağıtılır, tek panelden yönet.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Cloud,
    title: 'Cloud Backup',
    desc: 'Günlük şifreli otomatik yedekleme. S3, Backblaze veya SFTP. Tek tıkla geri yükleme.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
  },
  {
    icon: Smartphone,
    title: 'Tüm Oynatıcılar',
    desc: 'TiviMate, IPTV Smarters Pro, Kodi, GSE IPTV, VLC — Xtream Codes API ile tam uyumluluk.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    icon: HeadphonesIcon,
    title: 'Gerçek İnsan Desteği',
    desc: 'Ticket sistemi, otomatik log toplama, ortalama 2 saat yanıt süresi. Bot değil, insan.',
    color: 'text-lime-400',
    bg: 'bg-lime-500/10',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <SectionHeader
            badge="Özellikler"
            title={<>Rakiplerinizin <span className="gradient-text">Hayal Ettiği</span> Özellikler</>}
            subtitle="Yıllar içinde IPTV operatörlerinden dinlediklerimizle şekillenen, production'da savaşa girmiş özellikler."
          />
        </motion.div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              >
                <GlowCard className="group p-6 h-full">
                  <div className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-text-base mb-2">{feature.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{feature.desc}</p>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
