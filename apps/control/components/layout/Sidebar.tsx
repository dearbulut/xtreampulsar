'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Key, MessageSquare, FileText, LogOut } from 'lucide-react';
import { clearAuth } from '@/lib/auth';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Müşteriler', icon: Users },
  { href: '/licenses', label: 'Lisanslar', icon: Key },
  { href: '/tickets', label: 'Destek', icon: MessageSquare },
  { href: '/invoices', label: 'Faturalar', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <aside className="sidebar fixed inset-y-0 left-0 flex flex-col bg-gray-900 border-r border-gray-800 z-10">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800">
        <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs">XP</div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">Control</p>
          <p className="text-[10px] text-gray-500 mt-0.5">XtreamPulsar</p>
        </div>
      </div>
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'bg-brand-600/20 text-brand-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 py-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={16} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
