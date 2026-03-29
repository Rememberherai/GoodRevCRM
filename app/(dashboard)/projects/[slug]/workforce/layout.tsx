'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { ExternalLink, HardHat, Users, Briefcase, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/contexts/permissions';

const tabs = [
  { label: 'Contractors', href: 'contractors', icon: HardHat, resource: 'jobs.contractors' },
  { label: 'Employees', href: 'employees', icon: Users, resource: 'jobs.employees' },
  { label: 'Jobs', href: 'jobs', icon: Briefcase, resource: 'jobs.jobs' },
  { label: 'Timesheets', href: 'timesheets', icon: Clock, resource: 'jobs.timesheets' },
] as const;

export default function WorkforceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params.slug as string;
  const basePath = `/projects/${slug}/workforce`;
  const { isDenied } = usePermissions();

  const visibleTabs = useMemo(
    () => tabs.filter((t) => !isDenied(t.resource)),
    [isDenied]
  );

  const isContractorsActive = pathname.startsWith(`${basePath}/contractors`);

  if (visibleTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No workforce tabs available</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your current permissions do not grant access to any workforce features.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workforce</h2>
          <p className="text-sm text-muted-foreground">
            Manage contractors, employees, jobs, and timesheets.
          </p>
        </div>
        {isContractorsActive && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contractor/${slug}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Contractor Portal
            </Link>
          </Button>
        )}
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
