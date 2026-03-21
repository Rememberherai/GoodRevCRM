'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
