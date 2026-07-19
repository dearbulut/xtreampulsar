import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { LanguageProvider } from '@/lib/i18n';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'XtreamPulsar — Modern IPTV Panel | Tek Paket €70/ay',
  description:
    'Yeni nesil IPTV yönetim paneli. Tek tık migration, reseller sistemi + API + WHMCS, müşteri paneli, AI destek botu, şifreli yedekleme — hepsi tek pakette, €70/ay. Next-generation IPTV panel, everything included at €70/mo.',
  keywords: ['IPTV', 'IPTV Panel', 'Xtream Codes', 'XtreamUI alternatifi', 'IPTV yönetim paneli', 'IPTV management panel', 'Xtream panel'],
  authors: [{ name: 'XtreamPulsar' }],
  openGraph: {
    title: 'XtreamPulsar — Modern IPTV Panel',
    description: 'Tek paket, her şey dahil — €70/ay. One package, everything included — €70/mo.',
    type: 'website',
    locale: 'tr_TR',
    alternateLocale: 'en_US',
    siteName: 'XtreamPulsar',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XtreamPulsar — Modern IPTV Panel',
    description: 'Tek paket, her şey dahil — €70/ay.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
