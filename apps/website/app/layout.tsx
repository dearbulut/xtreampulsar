import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
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
  title: 'XtreamPulsar — Next Generation IPTV Panel',
  description:
    'XtreamUI, XUI.ONE ve Xtream-Masters\'ı geride bırakın. Modern arayüz, gerçek destek, tek tık migration. 30 gün ücretsiz deneyin.',
  keywords: ['IPTV', 'IPTV Panel', 'Xtream Codes', 'XtreamUI alternatifi', 'IPTV yönetim paneli'],
  authors: [{ name: 'XtreamPulsar' }],
  openGraph: {
    title: 'XtreamPulsar — Next Generation IPTV Panel',
    description: 'Modern IPTV panel. Tek tık migration, gerçek destek, şeffaf fiyat.',
    type: 'website',
    locale: 'tr_TR',
    siteName: 'XtreamPulsar',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XtreamPulsar — Next Generation IPTV Panel',
    description: 'Modern IPTV panel. Tek tık migration, gerçek destek, şeffaf fiyat.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
