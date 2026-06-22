import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function SuccessPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold mb-3">Ödeme Başarılı!</h1>
          <p className="text-gray-400 mb-6">
            Lisans anahtarınız e-posta adresinize gönderildi. Birkaç dakika içinde ulaşmazsa spam klasörünüzü kontrol edin.
          </p>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left mb-8">
            <h2 className="font-semibold text-white mb-3">Sonraki Adımlar</h2>
            <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
              <li>E-postanızdan lisans anahtarını kopyalayın</li>
              <li>Sunucunuza XtreamPulsar kurun: <code className="text-indigo-400">curl -sSL https://xtreampulsar.io/install.sh | bash</code></li>
              <li>Kurulum sırasında lisans anahtarınızı girin</li>
              <li>Panel açılışında otomatik aktivasyon gerçekleşir</li>
            </ol>
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-sm font-medium"
            >
              Ana Sayfaya Dön
            </Link>
            <a
              href="https://docs.xtreampulsar.io"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition text-sm font-medium"
            >
              Kurulum Kılavuzu →
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
