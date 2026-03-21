'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AdminHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
}

export function AdminHeader({ title, breadcrumbs }: AdminHeaderProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center px-3 md:px-6">
      <MobileMenuButton />
      <div className="ml-1 flex items-center gap-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {crumb.href ? (
                  <Link href={crumb.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">{crumb.label}</span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </span>
            ))}
            <h1 className="text-lg font-semibold truncate">{title}</h1>
          </>
        ) : (
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        )}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
