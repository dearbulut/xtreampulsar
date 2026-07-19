'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'tr' | 'en';

const tr = {
  nav: {
    features: 'Özellikler',
    addons: 'Dahil Eklentiler',
    comparison: 'Karşılaştırma',
    migration: 'Migration',
    pricing: 'Fiyat',
    faq: 'SSS',
    login: 'Panel Girişi',
    start: 'Hemen Başla',
  },
  hero: {
    badge: 'Yeni nesil IPTV yönetim paneli',
    title1: 'IPTV operasyonunuz için',
    title2: 'tek modern panel',
    subtitle:
      'Eski panelleri geride bırakın. Tek tık migration, yerleşik reseller sistemi, müşteri paneli, AI destekli müşteri hizmetleri ve rakiplerin ayrı sattığı tüm eklentiler — tek pakette, tek fiyatla.',
    ctaPrimary: 'Hemen Başla — €70/ay',
    ctaSecondary: 'Özellikleri Keşfet',
    trust1: 'Kurulum ~5 dakika',
    trust2: 'Xtream API %100 uyumlu',
    trust3: 'İstediğiniz zaman iptal',
    terminalTitle: 'kurulum — 5 dakikada canlıda',
    terminal: [
      '$ curl -fsSL https://get.xtreampulsar.com | bash',
      '✓ Docker ortamı hazırlandı',
      '✓ Panel + veritabanı + Xtream API başlatıldı',
      '✓ SSL sertifikası kuruldu',
      '→ Panel hazır: https://panel.sizindomain.com',
      '$ İçe aktarım: XtreamUI dump / M3U / Xtream API ✓',
    ],
  },
  stats: {
    uptime: 'Uptime hedefi',
    uptimeSuffix: '',
    install: 'Dakikada kurulum',
    compat: 'Xtream API uyumu',
    support: 'Destek',
    supportValue: '7/24',
  },
  features: {
    badge: 'Özellikler',
    title: 'Bir IPTV panelinden beklediğiniz her şey.',
    subtitle: 'Ve fazlası — hepsi ilk günden dahil, hiçbiri ek ücretli modül değil.',
    items: [
      { title: 'Xtream API %100 Uyumlu', desc: 'player_api.php, get.php, M3U çıktıları — mevcut player uygulamalarınız ve cihazlarınız hiçbir değişiklik olmadan çalışır.' },
      { title: 'Canlı • Film • Dizi Yönetimi', desc: 'Kanallar, VOD ve sezon/bölüm hiyerarşili diziler. TMDB metadata, poster ve süre bilgisi otomatik zenginleştirme.' },
      { title: 'Tek Tık Migration', desc: "XtreamUI / XUI.ONE veritabanı dump'ı, M3U listesi veya başka bir Xtream panelden — içerik, kullanıcı ve reseller'larınızla birlikte taşının." },
      { title: 'Otomatik M3U Senkronizasyonu', desc: 'Kaynak listeleriniz belirlediğiniz aralıklarla otomatik senkronize edilir; diziler otomatik olarak sezon/bölüm yapısında gruplanır.' },
      { title: 'Reseller Sistemi', desc: 'Kredi tabanlı bayi sistemi, alt bayiler, ayrı reseller portalı, paket ve fiyat yönetimi.' },
      { title: 'Reseller API + WHMCS', desc: 'REST API ile bayileriniz kendi otomasyonunu kurar; hazır WHMCS modülüyle faturalandırma entegrasyonu dakikalar sürer.' },
      { title: 'Müşteri Paneli', desc: 'Aboneleriniz kendi panelinden aboneliğini görür, playlist bağlantılarını alır, sorun bildirir ve destek ekibinizle mesajlaşır.' },
      { title: 'AI Destek Botu', desc: 'Destek taleplerine yapay zeka yanıt taslağı üretir — kendi Anthropic/OpenAI anahtarınızla, tam kontrol sizde.' },
      { title: 'Anti-Restream Güvenlik', desc: 'Bağlantı takibi, IP başına limit, restream tespiti, ülke kilidi ve Server Guard ile yayınlarınız korunur.' },
      { title: 'Şifreli Otomatik Yedekleme', desc: "AES-256 şifreli veritabanı yedekleri, zamanlanmış otomatik çalışır ve Dropbox'a uzaktan yüklenir." },
      { title: 'EPG Yönetimi', desc: 'Çoklu EPG kaynağı, otomatik ve manuel kanal eşleştirme, program rehberi.' },
      { title: 'White-Label + Ayrı Panel Adresleri', desc: "Kendi logonuz ve renkleriniz; reseller ve müşteri panellerini ayrı domain'lerde sunun — admin adresiniz asla görünmez." },
    ],
  },
  addons: {
    badge: 'Hepsi Dahil',
    title: 'Başkalarının ayrı sattığı her şey — dahil.',
    subtitle: "Rakip panellerde bunların her biri ek ücretli modüldür. XtreamPulsar'da tek fiyata hepsi var.",
    included: 'Dahil',
    elsewhere: 'rakiplerde ekstra',
    items: [
      { title: 'Müşteri Portalı', desc: 'Abone self-servis paneli + destek mesajlaşması' },
      { title: 'Otomatik M3U Sync', desc: 'Zamanlanmış kaynak senkronizasyonu' },
      { title: 'Reseller API + WHMCS', desc: 'REST API ve hazır WHMCS provizyon modülü' },
      { title: 'Şifreli Uzak Yedek', desc: 'AES-256 + otomatik Dropbox yükleme' },
      { title: 'IPTV Checker', desc: 'Harici hat/panel durum kontrol aracı' },
      { title: 'AI Destek Botu', desc: 'Yapay zeka destekli yanıt taslakları' },
    ],
  },
  comparison: {
    badge: 'Karşılaştırma',
    title: 'Eski panellerle aranızdaki fark.',
    subtitle: 'Yıllardır güncellenmeyen panellere ve modül başına ücret ödemeye son.',
    colFeature: 'Özellik',
    colOthers: 'Eski Paneller',
    colUs: 'XtreamPulsar',
    rows: [
      { label: 'Modern, hızlı arayüz', others: false, us: true },
      { label: 'Aktif geliştirme ve güncelleme', others: false, us: true },
      { label: 'Tek tık migration (dump / M3U / API)', others: false, us: true },
      { label: 'Müşteri paneli + destek mesajlaşması', others: 'paid', us: true },
      { label: 'Reseller API + WHMCS modülü', others: 'paid', us: true },
      { label: 'AI destek botu', others: false, us: true },
      { label: 'Şifreli uzak yedekleme', others: 'paid', us: true },
      { label: 'White-label + ayrı panel adresleri', others: 'paid', us: true },
      { label: 'Türkçe + İngilizce arayüz', others: false, us: true },
      { label: 'Tüm özellikler tek fiyatta', others: false, us: true },
    ],
    paidLabel: 'Ek ücretli',
    yesLabel: 'Dahil',
    noLabel: 'Yok',
  },
  migration: {
    badge: 'Migration',
    title: 'Geçiş korkutucu olmak zorunda değil.',
    subtitle: "Mevcut panelinizden XtreamPulsar'a geçiş üç adımda tamamlanır — içerikleriniz, kullanıcılarınız ve bayileriniz dahil.",
    steps: [
      { title: 'Kaynağı Bağlayın', desc: "XtreamUI / XUI.ONE veritabanı dump'ınızı yükleyin, M3U listenizi verin ya da mevcut Xtream panelinizin API bilgilerini girin." },
      { title: 'Önizleyin', desc: "İçe aktarılacak kanal, film, dizi, kullanıcı ve reseller'ları önceden görün. Çakışma modunu seçin: atla, birleştir veya üzerine yaz." },
      { title: 'İçe Aktarın', desc: 'Tek tıkla aktarım başlar; ilerleme canlı izlenir, yarıda kalırsa kaldığı yerden devam eder. Diziler otomatik sezon/bölüm yapısına oturur.' },
    ],
  },
  pricing: {
    badge: 'Fiyatlandırma',
    title: 'Tek paket. Her şey dahil.',
    subtitle: 'Modül başına ücret yok, sürpriz yok, kademe yok. Tüm özellikler tek fiyatta.',
    planName: 'XtreamPulsar Complete',
    perMonth: '/ay',
    planDesc: 'Tüm panel, tüm eklentiler, tüm güncellemeler — tek lisans.',
    cta: 'Hemen Başla',
    features: [
      'Sınırsız kullanıcı, stream ve içerik',
      'Xtream API %100 uyumluluk',
      'Canlı + VOD + Dizi (sezon/bölüm) yönetimi',
      'Tek tık migration (dump / M3U / Xtream API)',
      'Otomatik M3U senkronizasyonu',
      'Reseller sistemi + Reseller API + WHMCS',
      'Müşteri paneli + destek mesajlaşması',
      'AI destek botu (kendi anahtarınızla)',
      'Anti-restream güvenlik + Server Guard',
      'AES-256 şifreli otomatik uzak yedekleme',
      'EPG yönetimi + IPTV checker',
      'White-label + ayrı panel adresleri',
      'Türkçe + İngilizce arayüz',
      'Ücretsiz güncellemeler ve 7/24 destek',
    ],
    note1: 'Kurulum yardımı dahil',
    note2: 'Gizli ücret yok',
    note3: 'İstediğiniz zaman iptal',
  },
  faq: {
    badge: 'SSS',
    title: 'Sık sorulan sorular',
    items: [
      { q: 'Kurulum nasıl yapılıyor?', a: 'Tek komutla kendi sunucunuza kurulur (Docker tabanlı). Ortalama 5 dakika sürer; isterseniz kurulumu tamamen bizim ekibimiz yapar — ücretsiz.' },
      { q: 'Mevcut panelimden nasıl geçerim?', a: "XtreamUI / XUI.ONE veritabanı dump'ı, M3U listesi veya mevcut Xtream panelinizin API bilgisiyle tek tık migration yaparsınız. İçerikler, kullanıcılar ve reseller'lar taşınır; önce önizler, sonra uygularsınız." },
      { q: 'Sunucu gereksinimi nedir?', a: 'Ubuntu 22.04+ çalıştıran bir VPS/dedicated yeterlidir. Küçük operasyonlar için 4GB RAM ile başlayabilirsiniz; içerik ve kullanıcı sayınıza göre ölçeklenir.' },
      { q: '€70/ay fiyata neler dahil?', a: 'Her şey: tüm panel özellikleri, tüm eklentiler (müşteri portalı, reseller API + WHMCS, otomatik M3U sync, şifreli yedek, IPTV checker, AI bot), white-label, güncellemeler ve destek. Modül başına ek ücret yoktur.' },
      { q: 'White-label nasıl çalışıyor?', a: "Kendi logonuzu ve renklerinizi tanımlarsınız. Reseller ve müşteri panellerini kendi subdomain'lerinizde sunarsınız — bayileriniz ve aboneleriniz admin adresinizi hiç görmez." },
      { q: 'İptal edersem ne olur?', a: 'Abonelik aylıktır, istediğiniz zaman iptal edebilirsiniz. Verileriniz kendi sunucunuzda durur — dışa aktarabilir veya dilediğinizde geri dönebilirsiniz.' },
    ],
  },
  cta: {
    title: 'IPTV panelinizi bugün yükseltin.',
    subtitle: 'Kurulum 5 dakika, migration tek tık. Riski yok — istediğiniz zaman iptal.',
    button: 'Hemen Başla — €70/ay',
    login: 'Zaten müşteri misiniz? Panel girişi',
  },
  footer: {
    tagline: 'Operatörler için tasarlanmış yeni nesil IPTV yönetim paneli.',
    product: 'Ürün',
    resources: 'Kaynaklar',
    legal: 'Yasal',
    docs: 'Dokümantasyon',
    contact: 'İletişim',
    privacy: 'Gizlilik Politikası',
    terms: 'Kullanım Şartları',
    rights: 'Tüm hakları saklıdır.',
  },
  checkout: {
    title: 'Lisansınızı alın',
    subtitle: 'E-posta adresinizi girin ve güvenli ödemeye geçin. Lisans anahtarınız anında e-postanıza gelir.',
    emailPlaceholder: 'E-posta adresiniz',
    emailError: 'Geçerli bir e-posta adresi girin.',
    genericError: 'Bir hata oluştu, lütfen tekrar deneyin.',
    redirecting: 'Yönlendiriliyor…',
    buy: 'Satın Al — €70/ay',
    stripeNote: 'Ödeme Stripe üzerinden güvenle işlenir. İstediğiniz zaman iptal.',
    successTitle: 'Ödeme başarılı! 🎉',
    successDesc: 'Lisans anahtarınız e-posta adresinize gönderildi. Kurulum için dokümantasyonu izleyin ya da bizimle iletişime geçin — kurulumu sizin için yapalım.',
    successHome: 'Ana sayfaya dön',
    cancelTitle: 'Ödeme tamamlanmadı',
    cancelDesc: 'Ödeme işlemi iptal edildi. Sorun yaşadıysanız bizimle iletişime geçin, yardımcı olalım.',
    cancelRetry: 'Tekrar dene',
  },
};

const en: typeof tr = {
  nav: {
    features: 'Features',
    addons: 'Included Add-ons',
    comparison: 'Comparison',
    migration: 'Migration',
    pricing: 'Pricing',
    faq: 'FAQ',
    login: 'Panel Login',
    start: 'Get Started',
  },
  hero: {
    badge: 'Next-generation IPTV management panel',
    title1: 'One modern panel for',
    title2: 'your entire IPTV operation',
    subtitle:
      'Leave legacy panels behind. One-click migration, built-in reseller system, customer portal, AI-powered support and every add-on competitors sell separately — in one package, at one price.',
    ctaPrimary: 'Get Started — €70/mo',
    ctaSecondary: 'Explore Features',
    trust1: 'Setup in ~5 minutes',
    trust2: '100% Xtream API compatible',
    trust3: 'Cancel anytime',
    terminalTitle: 'install — live in 5 minutes',
    terminal: [
      '$ curl -fsSL https://get.xtreampulsar.com | bash',
      '✓ Docker environment prepared',
      '✓ Panel + database + Xtream API started',
      '✓ SSL certificate installed',
      '→ Panel ready: https://panel.yourdomain.com',
      '$ Import: XtreamUI dump / M3U / Xtream API ✓',
    ],
  },
  stats: {
    uptime: 'Uptime target',
    uptimeSuffix: '',
    install: 'Minute setup',
    compat: 'Xtream API compatibility',
    support: 'Support',
    supportValue: '24/7',
  },
  features: {
    badge: 'Features',
    title: 'Everything you expect from an IPTV panel.',
    subtitle: 'And more — all included from day one, none of it a paid module.',
    items: [
      { title: '100% Xtream API Compatible', desc: 'player_api.php, get.php, M3U outputs — your existing player apps and devices work without any changes.' },
      { title: 'Live • VOD • Series Management', desc: 'Channels, movies and series with season/episode hierarchy. Automatic TMDB metadata, posters and duration enrichment.' },
      { title: 'One-Click Migration', desc: 'From an XtreamUI / XUI.ONE database dump, an M3U list or another Xtream panel — move with your content, users and resellers.' },
      { title: 'Automatic M3U Sync', desc: 'Your source lists sync automatically on your schedule; series are auto-grouped into season/episode structure.' },
      { title: 'Reseller System', desc: 'Credit-based resellers, sub-resellers, a dedicated reseller portal, package and price management.' },
      { title: 'Reseller API + WHMCS', desc: 'Your resellers automate via REST API; the ready-made WHMCS module makes billing integration a matter of minutes.' },
      { title: 'Customer Portal', desc: 'Subscribers see their subscription, get playlist links, report issues and message your support team from their own panel.' },
      { title: 'AI Support Bot', desc: 'Generates AI reply drafts for support requests — with your own Anthropic/OpenAI key, fully under your control.' },
      { title: 'Anti-Restream Security', desc: 'Connection tracking, per-IP limits, restream detection, country lock and Server Guard protect your streams.' },
      { title: 'Encrypted Auto Backup', desc: 'AES-256 encrypted database backups run on schedule and upload remotely to Dropbox.' },
      { title: 'EPG Management', desc: 'Multiple EPG sources, automatic and manual channel mapping, TV guide.' },
      { title: 'White-Label + Separate Panel Hosts', desc: 'Your logo and colors; serve reseller and customer panels on separate domains — your admin address is never exposed.' },
    ],
  },
  addons: {
    badge: 'All Included',
    title: 'Everything others sell separately — included.',
    subtitle: 'In competitor panels each of these is a paid module. In XtreamPulsar they are all part of one price.',
    included: 'Included',
    elsewhere: 'extra elsewhere',
    items: [
      { title: 'Customer Portal', desc: 'Subscriber self-service panel + support messaging' },
      { title: 'Automatic M3U Sync', desc: 'Scheduled source synchronization' },
      { title: 'Reseller API + WHMCS', desc: 'REST API and ready WHMCS provisioning module' },
      { title: 'Encrypted Remote Backup', desc: 'AES-256 + automatic Dropbox upload' },
      { title: 'IPTV Checker', desc: 'External line/panel status checking tool' },
      { title: 'AI Support Bot', desc: 'AI-powered reply drafts' },
    ],
  },
  comparison: {
    badge: 'Comparison',
    title: 'The difference from legacy panels.',
    subtitle: 'Stop paying per module for panels that have not been updated in years.',
    colFeature: 'Feature',
    colOthers: 'Legacy Panels',
    colUs: 'XtreamPulsar',
    rows: [
      { label: 'Modern, fast interface', others: false, us: true },
      { label: 'Active development & updates', others: false, us: true },
      { label: 'One-click migration (dump / M3U / API)', others: false, us: true },
      { label: 'Customer portal + support messaging', others: 'paid', us: true },
      { label: 'Reseller API + WHMCS module', others: 'paid', us: true },
      { label: 'AI support bot', others: false, us: true },
      { label: 'Encrypted remote backup', others: 'paid', us: true },
      { label: 'White-label + separate panel hosts', others: 'paid', us: true },
      { label: 'Turkish + English interface', others: false, us: true },
      { label: 'All features at one price', others: false, us: true },
    ],
    paidLabel: 'Paid extra',
    yesLabel: 'Included',
    noLabel: 'None',
  },
  migration: {
    badge: 'Migration',
    title: 'Switching does not have to be scary.',
    subtitle: 'Moving from your current panel to XtreamPulsar takes three steps — content, users and resellers included.',
    steps: [
      { title: 'Connect the Source', desc: 'Upload your XtreamUI / XUI.ONE database dump, provide your M3U list, or enter your existing Xtream panel API credentials.' },
      { title: 'Preview', desc: 'See the channels, movies, series, users and resellers to be imported in advance. Pick a conflict mode: skip, merge or overwrite.' },
      { title: 'Import', desc: 'One click starts the transfer; progress is live, and interrupted imports resume where they left off. Series land in season/episode structure automatically.' },
    ],
  },
  pricing: {
    badge: 'Pricing',
    title: 'One package. Everything included.',
    subtitle: 'No per-module fees, no surprises, no tiers. All features at a single price.',
    planName: 'XtreamPulsar Complete',
    perMonth: '/mo',
    planDesc: 'The whole panel, every add-on, every update — one license.',
    cta: 'Get Started',
    features: [
      'Unlimited users, streams and content',
      '100% Xtream API compatibility',
      'Live + VOD + Series (season/episode) management',
      'One-click migration (dump / M3U / Xtream API)',
      'Automatic M3U synchronization',
      'Reseller system + Reseller API + WHMCS',
      'Customer portal + support messaging',
      'AI support bot (with your own key)',
      'Anti-restream security + Server Guard',
      'AES-256 encrypted automatic remote backup',
      'EPG management + IPTV checker',
      'White-label + separate panel hosts',
      'Turkish + English interface',
      'Free updates and 24/7 support',
    ],
    note1: 'Setup assistance included',
    note2: 'No hidden fees',
    note3: 'Cancel anytime',
  },
  faq: {
    badge: 'FAQ',
    title: 'Frequently asked questions',
    items: [
      { q: 'How does installation work?', a: 'It installs on your own server with a single command (Docker-based). It takes about 5 minutes on average; if you prefer, our team does the whole setup for you — free of charge.' },
      { q: 'How do I migrate from my current panel?', a: 'One-click migration from an XtreamUI / XUI.ONE database dump, an M3U list or your existing Xtream panel API. Content, users and resellers are transferred; you preview first, then apply.' },
      { q: 'What are the server requirements?', a: 'A VPS/dedicated server running Ubuntu 22.04+ is enough. Small operations can start with 4GB RAM; it scales with your content and user count.' },
      { q: 'What does €70/mo include?', a: 'Everything: all panel features, all add-ons (customer portal, reseller API + WHMCS, automatic M3U sync, encrypted backup, IPTV checker, AI bot), white-label, updates and support. There are no per-module fees.' },
      { q: 'How does white-label work?', a: 'You define your own logo and colors. You serve the reseller and customer panels on your own subdomains — your resellers and subscribers never see your admin address.' },
      { q: 'What happens if I cancel?', a: 'The subscription is monthly and you can cancel anytime. Your data stays on your own server — you can export it or come back whenever you like.' },
    ],
  },
  cta: {
    title: 'Upgrade your IPTV panel today.',
    subtitle: 'Setup in 5 minutes, migration in one click. No risk — cancel anytime.',
    button: 'Get Started — €70/mo',
    login: 'Already a customer? Panel login',
  },
  footer: {
    tagline: 'The next-generation IPTV management panel built for operators.',
    product: 'Product',
    resources: 'Resources',
    legal: 'Legal',
    docs: 'Documentation',
    contact: 'Contact',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    rights: 'All rights reserved.',
  },
  checkout: {
    title: 'Get your license',
    subtitle: 'Enter your email and proceed to secure checkout. Your license key arrives in your inbox instantly.',
    emailPlaceholder: 'Your email address',
    emailError: 'Please enter a valid email address.',
    genericError: 'Something went wrong, please try again.',
    redirecting: 'Redirecting…',
    buy: 'Buy Now — €70/mo',
    stripeNote: 'Payments are processed securely via Stripe. Cancel anytime.',
    successTitle: 'Payment successful! 🎉',
    successDesc: 'Your license key has been sent to your email address. Follow the documentation to install, or contact us — we will do the setup for you.',
    successHome: 'Back to home',
    cancelTitle: 'Payment not completed',
    cancelDesc: 'The payment was cancelled. If you ran into a problem, contact us and we will help.',
    cancelRetry: 'Try again',
  },
};

const DICTS: Record<Lang, typeof tr> = { tr, en };

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof tr;
}

const LangContext = createContext<LangContextValue>({ lang: 'tr', setLang: () => {}, t: tr });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('tr');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('xp-site-lang') as Lang | null;
      if (stored === 'tr' || stored === 'en') {
        setLangState(stored);
      } else if (typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('tr')) {
        setLangState('en');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('xp-site-lang', l); } catch { /* ignore */ }
  };

  return <LangContext.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
