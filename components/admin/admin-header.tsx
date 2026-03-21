'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center px-3 md:px-6">
      <MobileMenuButton />
      <h1 className="text-lg font-semibold ml-1">{title}</h1>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
