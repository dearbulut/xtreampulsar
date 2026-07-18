import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  variant = 'danger',
  loading,
}: Props) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3 mb-6">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            variant === 'danger' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning',
          )}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-300 pt-2">{message}</p>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-ghost">
          {t('common.cancel')}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
            variant === 'danger'
              ? 'bg-danger hover:bg-red-600 text-white'
              : 'bg-warning hover:bg-amber-500 text-black',
          )}
        >
          {loading ? t('ui.processing') : (confirmLabel ?? t('common.confirm'))}
        </button>
      </div>
    </Modal>
  );
}
