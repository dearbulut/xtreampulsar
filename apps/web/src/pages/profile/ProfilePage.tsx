import { useState } from 'react';
import { User, Lock, Shield } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

function useChangePassword() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/change-password', data),
    onSuccess: () => toast.success(t('profile.passwordChanged')),
    onError: () => toast.error(t('profile.passwordChangeFailed')),
  });
}

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const changePw = useChangePassword();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.passwordsMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('profile.passwordMin6'));
      return;
    }
    changePw.mutate({ currentPassword, newPassword }, {
      onSuccess: () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{t('profile.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('profile.subtitle')}</p>
      </div>

      {/* Account info */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-slate-200">{t('profile.accountInfo')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted mb-1">{t('profile.username')}</div>
            <div className="text-sm font-mono text-slate-200 bg-surface-2 rounded-lg px-3 py-2">{user?.username ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">{t('profile.role')}</div>
            <div className="text-sm text-slate-200 bg-surface-2 rounded-lg px-3 py-2">{user?.role ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-slate-200">{t('profile.changePassword')}</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="label">{t('profile.currentPassword')}</label>
            <input
              type="password"
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">{t('profile.newPassword')}</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">{t('profile.newPasswordRepeat')}</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={changePw.isPending || !currentPassword || !newPassword || !confirmPassword}
            >
              <Shield className="w-4 h-4" />
              {changePw.isPending ? t('profile.changing') : t('profile.changePasswordBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
