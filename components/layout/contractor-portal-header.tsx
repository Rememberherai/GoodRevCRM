'use client';

import Link from 'next/link';
import { MessageSquare, User, BriefcaseBusiness, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chat';

interface ContractorPortalHeaderProps {
  projectName: string;
  projectSlug: string;
}

export function ContractorPortalHeader({ projectName, projectSlug }: ContractorPortalHeaderProps) {
  const toggleChat = useChatStore((state) => state.toggle);

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Contractor Portal
          </div>
          <div className="truncate text-lg font-semibold">{projectName}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href={`/contractor/${projectSlug}`}>
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              Jobs
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/contractor/${projectSlug}/profile`}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/contractor/${projectSlug}/timesheet`}>
              <Clock className="mr-2 h-4 w-4" />
              Timesheet
            </Link>
          </Button>
          <Button variant="outline" onClick={toggleChat}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Button>
        </div>
      </div>
    </header>
  );
}
