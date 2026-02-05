'use client';

import { useState } from 'react';
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
  Phone,
  Calendar,
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  ActivityWithUser,
  ActivityEntityType,
  ActivityAction,
} from '@/types/activity';
import { ACTIVITY_TYPE_LABELS, OUTCOME_LABELS } from '@/types/activity';

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
  meeting: Calendar,
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

const activityTypeIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
  task: CheckSquare,
  sequence_completed: RefreshCw,
  system: Settings,
};

const activityTypeColors: Record<string, string> = {
  call: 'text-blue-600 bg-blue-100',
  email: 'text-cyan-600 bg-cyan-100',
  meeting: 'text-purple-600 bg-purple-100',
  note: 'text-amber-600 bg-amber-100',
  task: 'text-green-600 bg-green-100',
  sequence_completed: 'text-indigo-600 bg-indigo-100',
  system: 'text-gray-600 bg-gray-100',
};

const outcomeColors: Record<string, string> = {
  call_no_answer: 'bg-gray-100 text-gray-700',
  call_left_message: 'bg-yellow-100 text-yellow-700',
  call_back_later: 'bg-orange-100 text-orange-700',
  wrong_number: 'bg-red-100 text-red-700',
  do_not_call: 'bg-red-200 text-red-800',
  quality_conversation: 'bg-green-100 text-green-700',
  meeting_booked: 'bg-emerald-100 text-emerald-700',
  email_sent: 'bg-blue-100 text-blue-700',
  email_replied: 'bg-green-100 text-green-700',
  proposal_sent: 'bg-purple-100 text-purple-700',
  follow_up_scheduled: 'bg-orange-100 text-orange-700',
  not_interested: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
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
    case 'received':
      return `Received an email`;
    case 'opened':
      return `Email was opened`;
    case 'clicked':
      return `Email link was clicked`;
    case 'replied':
      return `Received a reply`;
    case 'logged':
      return `Logged a ${entityType}`;
    case 'completed':
      return `Completed a ${entityType}`;
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
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  function toggleNoteExpanded(activityId: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  }

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
        // CRM activity entry
        if (activity.activity_type) {
          const TypeIcon =
            activityTypeIcons[activity.activity_type] ?? Settings;
          const typeColor =
            activityTypeColors[activity.activity_type] ??
            'text-gray-600 bg-gray-100';
          const isExpanded = expandedNotes.has(activity.id);

          return (
            <div key={activity.id} className="relative flex gap-4 pl-10">
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-2 w-4 h-4 rounded-full flex items-center justify-center',
                  typeColor
                )}
              >
                <TypeIcon className="w-2.5 h-2.5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  {activity.user && (
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarImage
                        src={activity.user.avatar_url ?? undefined}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(activity.user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Subject line */}
                    <p className="text-sm">
                      <span className="font-medium">
                        {activity.subject ?? 'Untitled'}
                      </span>
                    </p>

                    {/* Type label + metadata row */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {ACTIVITY_TYPE_LABELS[activity.activity_type]}
                      </span>

                      {activity.direction && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          {activity.direction === 'outbound' ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownLeft className="w-3 h-3" />
                          )}
                          {activity.direction}
                        </span>
                      )}

                      {activity.duration_minutes != null && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {activity.duration_minutes}m
                        </span>
                      )}

                      {activity.outcome && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-4 border-0',
                            outcomeColors[activity.outcome] ??
                              'bg-gray-100 text-gray-700'
                          )}
                        >
                          {OUTCOME_LABELS[activity.outcome]}
                        </Badge>
                      )}
                    </div>

                    {/* Email content or Notes preview */}
                    {activity.notes && activity.activity_type === 'email' ? (
                      <div className="mt-1.5">
                        {activity.metadata?.to ? (
                          <p className="text-xs text-muted-foreground mb-1">
                            To: {String(activity.metadata.to)}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => toggleNoteExpanded(activity.id)}
                          className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              Hide email
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              View email
                            </>
                          )}
                        </button>
                        {isExpanded && (
                          <div
                            className="mt-2 rounded-md border bg-muted/50 p-3 text-xs prose prose-sm max-w-none dark:prose-invert overflow-auto max-h-[400px]"
                            dangerouslySetInnerHTML={{ __html: activity.notes }}
                          />
                        )}
                      </div>
                    ) : activity.notes ? (
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground">
                          {isExpanded
                            ? activity.notes
                            : activity.notes.length > 100
                              ? `${activity.notes.slice(0, 100)}...`
                              : activity.notes}
                        </p>
                        {activity.notes.length > 100 && (
                          <button
                            type="button"
                            onClick={() => toggleNoteExpanded(activity.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Show more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* Person link */}
                    {activity.person && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="hover:underline cursor-pointer text-primary">
                          {activity.person.first_name}{' '}
                          {activity.person.last_name}
                        </span>
                      </p>
                    )}

                    {/* Follow-up task pill */}
                    {activity.follow_up_task && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            activity.follow_up_task.status === 'completed'
                              ? 'bg-green-500'
                              : activity.follow_up_task.status === 'overdue'
                                ? 'bg-red-500'
                                : 'bg-yellow-500'
                          )}
                        />
                        Follow-up:{' '}
                        {activity.follow_up_task.due_date ??
                          activity.follow_up_task.title}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {activity.user?.full_name ?? 'Unknown user'}
                        {' \u00b7 '}
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Legacy audit-trail entry
        const EntityIcon = entityIcons[activity.entity_type] ?? FileText;
        const ActionIcon = actionIcons[activity.action] ?? Plus;
        const actionColor =
          actionColors[activity.action] ?? 'text-gray-600 bg-gray-100';

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
                    <AvatarImage
                      src={activity.user.avatar_url ?? undefined}
                    />
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
                      {Object.entries(activity.changes)
                        .slice(0, 3)
                        .map(([field, change]) => (
                          <div key={field} className="flex items-center gap-1">
                            <span className="capitalize">
                              {field.replace('_', ' ')}:
                            </span>
                            <span className="line-through">
                              {String(change.old ?? 'empty')}
                            </span>
                            <ArrowRight className="w-3 h-3" />
                            <span>{String(change.new ?? 'empty')}</span>
                          </div>
                        ))}
                      {Object.keys(activity.changes).length > 3 && (
                        <div>
                          +{Object.keys(activity.changes).length - 3} more
                          changes
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <EntityIcon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                      })}
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
