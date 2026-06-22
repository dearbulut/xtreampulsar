import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default function CancelPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold mb-3">Ödeme İptal Edildi</h1>
          <p className="text-gray-400 mb-8">
            Ödeme işlemini tamamlamadınız. Herhangi bir ücret alınmadı. Dilediğiniz zaman tekrar deneyebilirsiniz.
          </p>

          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-sm font-medium"
            >
              Ana Sayfaya Dön
            </Link>
            <Link
              href="/pricing"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition text-sm font-medium"
            >
              Tekrar Dene
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
