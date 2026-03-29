'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { HandCoins, Clock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/contexts/permissions';

const tabs = [
  { label: 'Donations', href: 'donations', icon: HandCoins, resource: 'contributions.donations' },
  { label: 'Time Log', href: 'time-log', icon: Clock, resource: 'contributions.time_log' },
] as const;

export default function ContributionsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const basePath = `/projects/${slug}/contributions`;
  const { isDenied } = usePermissions();

  const visibleTabs = useMemo(
    () => tabs.filter((t) => !isDenied(t.resource)),
    [isDenied]
  );

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No contribution tabs available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your current permissions do not grant access to any contribution features.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Contributions</h2>
        <p className="text-sm text-muted-foreground">
          Track donations, grants, work hours, and service activity.
        </p>
      </div>

      <nav className="flex gap-1 border-b">
        {visibleTabs.map((tab) => {
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

      {children}
    </div>
  );
}
