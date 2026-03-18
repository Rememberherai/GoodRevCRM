'use client';

import { ModuleSwitcher } from '@/components/layout/module-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useNotifications } from '@/hooks/use-notifications';

export function AccountingHeader() {
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
        <ModuleSwitcher />
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
