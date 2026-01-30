'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  User,
  Building2,
  Target,
  FileText,
  CheckSquare,
  StickyNote,
  Mail,
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ActivityWithUser, ActivityEntityType, ActivityAction } from '@/types/activity';

interface ActivityTimelineProps {
  activities: ActivityWithUser[];
  loading?: boolean;
  emptyMessage?: string;
}

const entityIcons: Record<ActivityEntityType, typeof User> = {
  person: User,
  organization: Building2,
  opportunity: Target,
  rfp: FileText,
  task: CheckSquare,
  note: StickyNote,
  sequence: RefreshCw,
  email: Mail,
};

const actionIcons: Partial<Record<ActivityAction, typeof Plus>> = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  status_changed: ArrowRight,
  stage_changed: ArrowRight,
};

const actionColors: Partial<Record<ActivityAction, string>> = {
  created: 'text-green-600 bg-green-100',
  updated: 'text-blue-600 bg-blue-100',
  deleted: 'text-red-600 bg-red-100',
  restored: 'text-emerald-600 bg-emerald-100',
  status_changed: 'text-purple-600 bg-purple-100',
  stage_changed: 'text-orange-600 bg-orange-100',
  sent: 'text-cyan-600 bg-cyan-100',
};

function getActivityDescription(activity: ActivityWithUser): string {
  const entityType = activity.entity_type.replace('_', ' ');

  switch (activity.action) {
    case 'created':
      return `Created a new ${entityType}`;
    case 'updated':
      return `Updated a ${entityType}`;
    case 'deleted':
      return `Deleted a ${entityType}`;
    case 'restored':
      return `Restored a ${entityType}`;
    case 'assigned':
      return `Assigned a ${entityType}`;
    case 'unassigned':
      return `Unassigned a ${entityType}`;
    case 'status_changed':
      return `Changed status of a ${entityType}`;
    case 'stage_changed':
      return `Changed stage of an ${entityType}`;
    case 'enrolled':
      return `Enrolled in a sequence`;
    case 'unenrolled':
      return `Unenrolled from a sequence`;
    case 'sent':
      return `Sent an email`;
    case 'opened':
      return `Email was opened`;
    case 'clicked':
      return `Email link was clicked`;
    case 'replied':
      return `Received a reply`;
    default:
      return `${activity.action} a ${entityType}`;
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ActivityTimeline({
  activities,
  loading = false,
  emptyMessage = 'No activity yet',
}: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
    );
  }

  return (
    <div className="relative space-y-4">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      {activities.map((activity) => {
        const EntityIcon = entityIcons[activity.entity_type] ?? FileText;
        const ActionIcon = actionIcons[activity.action] ?? Plus;
        const actionColor = actionColors[activity.action] ?? 'text-gray-600 bg-gray-100';

        return (
          <div key={activity.id} className="relative flex gap-4 pl-10">
            {/* Timeline dot */}
            <div
              className={cn(
                'absolute left-2 w-4 h-4 rounded-full flex items-center justify-center',
                actionColor
              )}
            >
              <ActionIcon className="w-2.5 h-2.5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                {activity.user && (
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    <AvatarImage src={activity.user.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(activity.user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">
                      {activity.user?.full_name ?? 'Unknown user'}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {getActivityDescription(activity)}
                    </span>
                  </p>

                  {/* Show changes if any */}
                  {Object.keys(activity.changes).length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      {Object.entries(activity.changes).slice(0, 3).map(([field, change]) => (
                        <div key={field} className="flex items-center gap-1">
                          <span className="capitalize">{field.replace('_', ' ')}:</span>
                          <span className="line-through">{String(change.old ?? 'empty')}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>{String(change.new ?? 'empty')}</span>
                        </div>
                      ))}
                      {Object.keys(activity.changes).length > 3 && (
                        <div>+{Object.keys(activity.changes).length - 3} more changes</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <EntityIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
