'use client';
import { getAdmin } from '@/lib/auth';
import { User } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const admin = getAdmin();
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <User size={15} />
        <span>{admin?.username ?? 'Admin'}</span>
      </div>
    </header>
  );
}
