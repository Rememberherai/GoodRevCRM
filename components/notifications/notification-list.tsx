'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  Trash2,
  ExternalLink,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Notification, NotificationPriority } from '@/types/notification';

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onActionClick?: (notification: Notification) => void;
}

const priorityIcons: Record<NotificationPriority, React.ComponentType<{ className?: string }>> = {
  low: Info,
  normal: Bell,
  high: AlertCircle,
  urgent: AlertCircle,
};

const priorityColors: Record<NotificationPriority, string> = {
  low: 'text-muted-foreground',
  normal: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export function NotificationList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onArchive,
  onDelete,
  onActionClick,
}: NotificationListProps) {
  const [processing, setProcessing] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleAction = async (action: () => Promise<void>, id?: string) => {
    setProcessing(id || 'all');
    try {
      await action();
    } finally {
      setProcessing(null);
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Bell className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No notifications</p>
        <p className="text-sm">You&apos;re all caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <span className="font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction(onMarkAllAsRead)}
            disabled={processing === 'all'}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {notifications.map((notification) => {
            const PriorityIcon = priorityIcons[notification.priority];
            const isProcessing = processing === notification.id;

            return (
              <div
                key={notification.id}
                className={cn(
                  'p-4 hover:bg-muted/50 transition-colors',
                  !notification.read_at && 'bg-muted/30'
                )}
              >
                <div className="flex gap-3">
                  <div
                    className={cn(
                      'flex-shrink-0 mt-1',
                      priorityColors[notification.priority]
                    )}
                  >
                    <PriorityIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm',
                            !notification.read_at && 'font-semibold'
                          )}
                        >
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {!notification.read_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleAction(() => onMarkAsRead(notification.id), notification.id)
                            }
                            disabled={isProcessing}
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            handleAction(() => onArchive(notification.id), notification.id)
                          }
                          disabled={isProcessing}
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            handleAction(() => onDelete(notification.id), notification.id)
                          }
                          disabled={isProcessing}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {notification.action_url && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onActionClick?.(notification)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
