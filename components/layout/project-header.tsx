'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { SearchTrigger } from '@/components/search';
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
    <header className="h-14 border-b bg-card flex items-center px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">GoodRev CRM</h1>
      </div>
      <div className="flex-1 flex justify-center px-4">
        <SearchTrigger projectSlug={project.slug} />
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
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
