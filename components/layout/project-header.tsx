'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { ModuleSwitcher } from '@/components/layout/module-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ProcessQueueButton } from '@/components/layout/process-queue-button';
import { BugReportButton } from '@/components/bug-report/bug-report-button';
import { PublicLinksButton } from '@/components/layout/public-links-button';
import { ApiKeysRequiredButton } from '@/components/layout/api-keys-required-button';
import { SearchTrigger } from '@/components/search';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';
import { useNotifications } from '@/hooks/use-notifications';
import type { Project } from '@/types/project';

interface ProjectHeaderProps {
  project: Project;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const {
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onArchive,
    onDelete,
    onActionClick,
  } = useNotifications();

  return (
    <header className="h-14 border-b bg-card flex items-center px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <MobileMenuButton />
        <ModuleSwitcher />
      </div>
      <div className="flex-1 flex justify-center px-2 md:px-4">
        <SearchTrigger projectSlug={project.slug} />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <span className="hidden md:inline-flex"><ApiKeysRequiredButton projectSlug={project.slug} /></span>
        <span className="hidden md:inline-flex"><PublicLinksButton projectSlug={project.slug} projectType={project.project_type} /></span>
        <span className="hidden md:inline-flex"><BugReportButton /></span>
        <span className="hidden md:inline-flex"><ProcessQueueButton /></span>
        <span className="hidden md:inline-flex"><ThemeToggle /></span>
        <NotificationBell
          notifications={notifications}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
          onArchive={onArchive}
          onDelete={onDelete}
          onActionClick={onActionClick}
        />
        <UserMenu />
      </div>
    </header>
  );
}
