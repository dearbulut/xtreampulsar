import { Link } from '@tanstack/react-router';
import { Compass, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6">
      <div className="card p-10 max-w-md w-full text-center flex flex-col items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Compass className="w-8 h-8" />
        </div>
        <div>
          <div className="text-5xl font-bold text-gradient leading-none">404</div>
          <h1 className="text-lg font-semibold text-fg mt-3">{t('notFound.title')}</h1>
          <p className="text-sm text-muted mt-1">{t('notFound.subtitle')}</p>
        </div>
        <Link to="/dashboard" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('notFound.back')}
        </Link>
      </div>
    </div>
  );
}
