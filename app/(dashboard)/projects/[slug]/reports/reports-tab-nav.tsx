'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { BarChart3, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Reports', href: 'overview', icon: BarChart3 },
  { label: 'Public Dashboard', href: 'public-dashboard', icon: Globe },
] as const;

export function ReportsTabNav() {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const basePath = `/projects/${slug}/reports`;

  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.href}`;
        const isActive = pathname.startsWith(href);
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
  );
}
