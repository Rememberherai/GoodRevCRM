'use client';

import { ModuleSwitcher } from '@/components/layout/module-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';
import { useNotifications } from '@/hooks/use-notifications';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CalendarHeaderProps {
  projects: { id: string; name: string; slug: string }[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}

export function CalendarHeader({
  projects,
  selectedProjectId,
  onProjectChange,
}: CalendarHeaderProps) {
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
        {projects.length > 0 && (
          <Select
            value={selectedProjectId || undefined}
            onValueChange={onProjectChange}
          >
            <SelectTrigger className="w-[140px] sm:w-[200px] h-8 text-sm">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex-1" />
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
