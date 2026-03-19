'use client';

import { useState } from 'react';
import { CalendarSidebar } from '@/components/layout/calendar-sidebar';
import { CalendarHeader } from '@/components/layout/calendar-header';
import { CalendarProvider } from './calendar-context';
import type { CalendarProfile } from '@/types/calendar';

interface CalendarShellProps {
  profile: CalendarProfile | null;
  projects: { id: string; name: string; slug: string }[];
  children: React.ReactNode;
}

export function CalendarShell({ profile, projects, children }: CalendarShellProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null
  );

  const profileSlug = profile?.slug ?? null;

  const wrappedChildren = (
    <CalendarProvider selectedProjectId={selectedProjectId} profileSlug={profileSlug}>
      {children}
    </CalendarProvider>
  );

  // If no profile exists, show onboarding (the page.tsx handles this)
  if (!profile) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex flex-col flex-1 overflow-hidden">
          <CalendarHeader
            projects={projects}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
          <main className="flex-1 overflow-auto p-6">{wrappedChildren}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <CalendarSidebar profileSlug={profile.slug} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <CalendarHeader
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />
        <main className="flex-1 overflow-auto p-6">{wrappedChildren}</main>
      </div>
    </div>
  );
}
