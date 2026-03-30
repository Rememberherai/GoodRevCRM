'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Home, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Households', href: '', icon: Home },
  { label: 'Cases', href: '/cases', icon: ClipboardList },
] as const;

export default function HouseholdsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const basePath = `/projects/${slug}/households`;

  // Don't show the sub-nav on household detail pages (e.g. /households/[id])
  const isDetailPage = /\/households\/[^/]+/.test(pathname) && !pathname.endsWith('/cases');

  if (isDetailPage) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Households</h2>
        <p className="text-sm text-muted-foreground">
          Track families, living units, primary contacts, and case plans.
        </p>
      </div>

      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const href = `${basePath}${tab.href}`;
          const isActive = tab.href === ''
            ? pathname === basePath || pathname === `${basePath}/`
            : pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
