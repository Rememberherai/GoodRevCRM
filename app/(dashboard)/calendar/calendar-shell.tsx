'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarSidebar } from '@/components/layout/calendar-sidebar';
import { CalendarHeader } from '@/components/layout/calendar-header';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { CalendarProvider } from './calendar-context';
import type { CalendarProfile } from '@/types/calendar';

interface CalendarShellProps {
  profile: CalendarProfile | null;
  projects: { id: string; name: string; slug: string }[];
  children: React.ReactNode;
}

export function CalendarShell({ profile, projects, children }: CalendarShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null
  );

  const profileSlug = profile?.slug ?? null;

  const wrappedChildren = (
    <CalendarProvider selectedProjectId={selectedProjectId} profileSlug={profileSlug}>
      {children}
    </CalendarProvider>
  );

  useEffect(() => {
    if (!profile && pathname !== '/calendar/settings') {
      router.replace('/calendar/settings');
    }
  }, [pathname, profile, router]);

  if (!profile) {
    const isSettingsPage = pathname === '/calendar/settings';

    return (
      <div className="flex h-screen bg-background">
        <div className="flex flex-col flex-1 overflow-hidden">
          <CalendarHeader
            projects={projects}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
          <main className="flex-1 overflow-auto p-6">
            {isSettingsPage ? wrappedChildren : (
              <div className="p-6 text-muted-foreground">Redirecting to calendar settings...</div>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <CalendarSidebar profileSlug={profile.slug} />
      <MobileSidebar>
        <CalendarSidebar profileSlug={profile.slug} className="flex w-full border-r-0" />
      </MobileSidebar>
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <CalendarHeader
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">{wrappedChildren}</main>
      </div>
    </div>
  );
}
