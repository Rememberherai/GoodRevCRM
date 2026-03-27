'use client';

import Link from 'next/link';
import { Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmployeePortalHeaderProps {
  projectName: string;
  projectSlug: string;
}

export function EmployeePortalHeader({ projectName, projectSlug }: EmployeePortalHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Employee Portal
          </div>
          <div className="truncate text-lg font-semibold">{projectName}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href={`/employee/${projectSlug}/timesheet`}>
              <Clock className="mr-2 h-4 w-4" />
              Timesheet
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/employee/${projectSlug}/profile`}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
