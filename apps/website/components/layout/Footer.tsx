import { Zap, Twitter, Github, Youtube } from 'lucide-react';

const FOOTER_LINKS = {
  Ürün: [
    { label: 'Özellikler', href: '#features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Karşılaştırma', href: '#comparison' },
    { label: 'Migration', href: '#migration' },
    { label: 'Referanslar', href: '#testimonials' },
    { label: 'SSS', href: '#faq' },
  ],
  Kaynaklar: [
    { label: 'Dokümantasyon', href: 'https://docs.xtreampulsar.io' },
    { label: 'API Referansı', href: '#' },
    { label: 'Kurulum Rehberi', href: '#' },
    { label: 'Video Eğitimleri', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Topluluk', href: '#' },
  ],
  Şirket: [
    { label: 'Hakkımızda', href: '#' },
    { label: 'İletişim', href: '#' },
    { label: 'Destek', href: 'mailto:support@xtreampulsar.io' },
    { label: 'İş Ortaklığı', href: '#' },
    { label: 'Affiliate Programı', href: '#' },
  ],
  Yasal: [
    { label: 'Gizlilik Politikası', href: '#' },
    { label: 'Kullanım Koşulları', href: '#' },
    { label: 'Çerez Politikası', href: '#' },
    { label: 'KVKK', href: '#' },
    { label: 'SLA', href: '#' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Twitter, label: 'Twitter', href: 'https://twitter.com/xtreampulsar' },
  { icon: Github, label: 'GitHub', href: 'https://github.com/xtreampulsar' },
  { icon: Youtube, label: 'YouTube', href: 'https://youtube.com/@xtreampulsar' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600" />
                <Zap className="relative w-5 h-5 text-white" fill="currentColor" />
              </div>
              <span className="font-bold text-lg text-text-base">
                Xtream<span className="text-primary">Pulsar</span>
              </span>
            </a>
            <p className="text-sm text-text-muted leading-relaxed max-w-xs">
              Yeni nesil IPTV yönetim paneli. Modern arayüz, güçlü API, gerçek destek.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h3 className="text-sm font-semibold text-text-base mb-4">{group}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-muted hover:text-text-base transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-text-muted">
            © {new Date().getFullYear()} XtreamPulsar. Tüm hakları saklıdır.
          </p>
          <p className="text-sm text-text-muted">
            Made with ♥ for IPTV operators worldwide
          </p>
        </div>
      </div>
    </footer>
  );
}
