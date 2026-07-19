import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from '@/i18n/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | string, decimals = 1): string {
  const n = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (!n || n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatBytesPerSec(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec * 8)}/s`.replace('B/s', 'bps');
}

export function formatDuration(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function daysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function dateLocale(): string {
  const l = i18n.language || 'tr';
  return l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'ar' ? 'ar' : 'en-GB';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(dateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(dateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // 1) Secure-context async Clipboard API (https / localhost)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallbacks
  }
  // 2) copy-event override — focus/selection independent, so it survives modal
  // focus-traps and works on plain-http self-hosted panels (no secure context).
  try {
    let ok = false;
    const listener = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', text);
        e.preventDefault();
        ok = true;
      }
    };
    document.addEventListener('copy', listener as EventListener);
    const dispatched = document.execCommand('copy');
    document.removeEventListener('copy', listener as EventListener);
    if (ok && dispatched) return true;
  } catch {
    // fall through to textarea fallback
  }
  // 3) Last resort: temporary textarea + execCommand (needs focus/selection)
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '0';
    ta.style.top = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch { /* noop */ }
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function truncate(str: string, n = 40): string {
  return str.length > n ? `${str.slice(0, n)}…` : str;
}
