import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Plus, Trash2, Copy, Check, Terminal } from 'lucide-react';
import {
  useResellerApiKeys, useCreateResellerApiKey, useRevokeResellerApiKey,
} from '@/hooks/useResellerPanel';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, copyToClipboard, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export function ResellerApiPage() {
  const { t } = useTranslation();
  const { data: keys = [], isLoading } = useResellerApiKeys();
  const create = useCreateResellerApiKey();
  const revoke = useRevokeResellerApiKey();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const base = `${window.location.origin}/api/v1/reseller-api`;

  const generate = () => {
    create.mutate(name.trim() || 'API Key', {
      onSuccess: (data) => { setNewKey(data.key); setName(''); },
      onError: () => toast.error(t('resellerApi.createError')),
    });
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-fg flex items-center gap-2"><KeyRound className="w-6 h-6 text-primary" />{t('resellerApi.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('resellerApi.subtitle')}</p>
      </div>

      {/* Base URL */}
      <div className="card p-4">
        <div className="text-xs text-muted mb-1">{t('resellerApi.baseUrl')}</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono bg-surface-2 rounded-lg px-3 py-2 truncate">{base}</code>
          <button className="btn-ghost p-2" onClick={() => { void copyToClipboard(base); toast.success(t('resellerApi.copied')); }}><Copy className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted mt-2">{t('resellerApi.authNote')} <code className="font-mono">X-API-Key</code></p>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="card p-4 border-primary/40 bg-primary/5">
          <div className="text-xs text-warning font-medium mb-1">{t('resellerApi.saveOnce')}</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-surface-2 rounded-lg px-3 py-2 truncate">{newKey}</code>
            <button className="btn-primary flex items-center gap-1" onClick={() => { void copyToClipboard(newKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{t('resellerApi.copy')}
            </button>
          </div>
        </div>
      )}

      {/* Generate */}
      <div className="card p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="label">{t('resellerApi.keyName')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="WHMCS Production" />
        </div>
        <button className="btn-primary flex items-center gap-2" disabled={create.isPending} onClick={generate}>
          <Plus className="w-4 h-4" />{t('resellerApi.generate')}
        </button>
      </div>

      {/* Keys list */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center"><LoadingSpinner /></div>
        ) : keys.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-muted">{t('resellerApi.noKeys')}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">{t('resellerApi.colName')}</th>
                <th className="table-th">{t('resellerApi.colKey')}</th>
                <th className="table-th">{t('resellerApi.colLastUsed')}</th>
                <th className="table-th text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="table-row">
                  <td className="table-td font-medium text-fg">{k.name}</td>
                  <td className="table-td font-mono text-xs text-muted">{k.key}</td>
                  <td className="table-td text-xs text-muted">{k.lastUsedAt ? formatDate(k.lastUsedAt) : t('resellerApi.never')}</td>
                  <td className="table-td text-right">
                    <button className="btn-ghost p-1.5" title={t('resellerApi.revoke')} onClick={() => revoke.mutate(k.id)}>
                      <Trash2 className="w-4 h-4 text-danger" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Endpoint reference */}
      <div className="card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg mb-3"><Terminal className="w-4 h-4" />{t('resellerApi.endpoints')}</div>
        <div className="space-y-1.5 text-xs font-mono">
          {[
            ['GET', '/me', t('resellerApi.epMe')],
            ['GET', '/packages', t('resellerApi.epPackages')],
            ['GET', '/users', t('resellerApi.epUsers')],
            ['POST', '/users', t('resellerApi.epCreate')],
            ['GET', '/users/:username', t('resellerApi.epGet')],
            ['POST', '/users/:username/extend', t('resellerApi.epExtend')],
            ['POST', '/users/:username/status', t('resellerApi.epStatus')],
            ['DELETE', '/users/:username', t('resellerApi.epDelete')],
          ].map(([m, path, desc]) => (
            <div key={path} className="flex items-center gap-2">
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold w-14 text-center',
                m === 'GET' ? 'bg-info/15 text-info' : m === 'POST' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>{m}</span>
              <span className="text-fg">{path}</span>
              <span className="text-muted">— {desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">{t('resellerApi.whmcsNote')}</p>
      </div>
    </div>
  );
}
