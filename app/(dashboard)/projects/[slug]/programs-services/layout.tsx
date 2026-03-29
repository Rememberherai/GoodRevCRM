'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { CalendarRange, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Programs', href: 'programs', icon: CalendarRange },
  { label: 'Referrals', href: 'referrals', icon: ArrowRightLeft },
] as const;

export default function ProgramsServicesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const basePath = `/projects/${slug}/programs-services`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Programs &amp; Services</h2>
        <p className="text-sm text-muted-foreground">
          Manage community programs, track enrollment, and coordinate referrals.
        </p>
      </div>

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

      {children}
    </div>
  );
}
