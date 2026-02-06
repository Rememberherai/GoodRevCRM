'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Phone,
  Mail,
  Calendar,
  StickyNote,
  CheckSquare,
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ActivityTimeline } from '@/components/activity/activity-timeline';
import { LogActivityModal } from '@/components/activity/log-activity-modal';
import { BookMeetingModal } from '@/components/meetings/book-meeting-modal';
import { useActivities } from '@/hooks/use-activities';
import {
  ACTIVITY_TYPE_OUTCOMES,
  OUTCOME_LABELS,
} from '@/types/activity';
import type { ActivityWithUser, ActivityType, ActivityOutcome } from '@/types/activity';
import type { MeetingWithRelations } from '@/types/meeting';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardActivityCenterProps {
  projectSlug: string;
}

type FollowUpFilter = 'overdue' | 'today' | 'upcoming' | 'all';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  email_opened: 'bg-blue-100 text-blue-700',
  email_replied: 'bg-green-100 text-green-700',
  proposal_sent: 'bg-purple-100 text-purple-700',
  follow_up_scheduled: 'bg-orange-100 text-orange-700',
  not_interested: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardActivityCenter({
  projectSlug,
}: DashboardActivityCenterProps) {
  // ---- Follow-up queue state ----
  const [followUps, setFollowUps] = useState<ActivityWithUser[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FollowUpFilter>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);

  // ---- Meetings state ----
  const [meetings, setMeetings] = useState<MeetingWithRelations[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  // ---- Modal state ----
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [bookMeetingOpen, setBookMeetingOpen] = useState(false);

  // ---- Recent activity via hook ----
  const {
    activities: recentActivities,
    isLoading: recentLoading,
    refresh: refreshRecent,
  } = useActivities({ projectSlug, limit: 10 });

  // -----------------------------------------------------------------------
  // Follow-up queue data
  // -----------------------------------------------------------------------

  const loadFollowUps = useCallback(async () => {
    if (!projectSlug) return;
    setFollowUpsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.set('status', activeFilter);
      }
      const response = await fetch(
        `/api/projects/${projectSlug}/activity/follow-ups?${params.toString()}`
      );
      if (!response.ok) throw new Error('Failed to fetch follow-ups');
      const data = await response.json();
      const items: ActivityWithUser[] = data.data ?? data.activities ?? data ?? [];
      setFollowUps(items);
    } catch {
      toast.error('Failed to load follow-ups');
    } finally {
      setFollowUpsLoading(false);
    }
  }, [projectSlug, activeFilter]);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  // -----------------------------------------------------------------------
  // Meetings data
  // -----------------------------------------------------------------------

  const loadMeetings = useCallback(async () => {
    if (!projectSlug) return;
    setMeetingsLoading(true);
    try {
      const now = new Date().toISOString();
      const response = await fetch(
        `/api/projects/${projectSlug}/meetings?status=scheduled&scheduled_after=${now}&limit=5`
      );
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      const items: MeetingWithRelations[] =
        data.data ?? data.meetings ?? data ?? [];
      setMeetings(items);
    } catch {
      // Silently fail — section will show empty state
    } finally {
      setMeetingsLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // -----------------------------------------------------------------------
  // Follow-up counts by category
  // -----------------------------------------------------------------------

  const followUpCounts = useMemo(() => {
    const counts = { overdue: 0, today: 0, upcoming: 0, all: followUps.length };
    for (const item of followUps) {
      const dueDate = item.follow_up_task?.due_date ?? item.follow_up_date;
      if (!dueDate) continue;
      const parsed = parseISO(dueDate);
      if (isToday(parsed)) {
        counts.today++;
      } else if (isPast(parsed)) {
        counts.overdue++;
      } else {
        counts.upcoming++;
      }
    }
    return counts;
  }, [followUps]);

  // -----------------------------------------------------------------------
  // Complete a follow-up with outcome
  // -----------------------------------------------------------------------

  async function completeFollowUp(activity: ActivityWithUser, outcome: string) {
    if (!activity.follow_up_task_id) return;
    setCompletingId(activity.id);
    try {
      // 1. PATCH the task to completed
      const taskRes = await fetch(
        `/api/projects/${projectSlug}/tasks/${activity.follow_up_task_id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }
      );
      if (!taskRes.ok) throw new Error('Failed to complete task');

      // 2. POST new activity log with the outcome
      const logRes = await fetch(
        `/api/projects/${projectSlug}/activity/log`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_type: activity.activity_type ?? 'call',
            person_id: activity.person_id,
            organization_id: activity.organization_id,
            subject: `Follow-up: ${activity.subject}`,
            outcome,
          }),
        }
      );
      if (!logRes.ok) throw new Error('Failed to log activity');

      // 3. Refresh data
      toast.success('Follow-up completed');
      loadFollowUps();
      refreshRecent();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to complete follow-up'
      );
    } finally {
      setCompletingId(null);
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function getFollowUpStatusIndicator(activity: ActivityWithUser) {
    const taskStatus = activity.follow_up_task?.status;
    if (taskStatus === 'completed') {
      return <span className="inline-block w-2 h-2 rounded-full bg-green-500" />;
    }
    const dueDate = activity.follow_up_task?.due_date ?? activity.follow_up_date;
    if (dueDate && isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))) {
      return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
    }
    return <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />;
  }

  function formatDueDate(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const parsed = parseISO(dateStr);
    return formatDistanceToNow(parsed, { addSuffix: true });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ================================================================
            COLUMN 1: Follow-up Queue (1/3 width on desktop)
            ================================================================ */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4" />
                  Follow-up Queue
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => loadFollowUps()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeFilter}
                onValueChange={(v) => setActiveFilter(v as FollowUpFilter)}
                className="w-full"
              >
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="overdue" className="flex-1 gap-1.5">
                    Overdue
                    {followUpCounts.overdue > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                        {followUpCounts.overdue}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="today" className="flex-1 gap-1.5">
                    Today
                    {followUpCounts.today > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                        {followUpCounts.today}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="upcoming" className="flex-1 gap-1.5">
                    Upcoming
                    {followUpCounts.upcoming > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                        {followUpCounts.upcoming}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex-1 gap-1.5">
                    All
                    {followUpCounts.all > 0 && (
                      <Badge variant="outline" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">
                        {followUpCounts.all}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* All tab panels share the same content — the filter is applied via API param */}
                {(['overdue', 'today', 'upcoming', 'all'] as const).map(
                  (tab) => (
                    <TabsContent key={tab} value={tab}>
                      <FollowUpList
                        loading={followUpsLoading}
                        items={followUps}
                        completingId={completingId}
                        onComplete={completeFollowUp}
                        getStatusIndicator={getFollowUpStatusIndicator}
                        formatDueDate={formatDueDate}
                      />
                    </TabsContent>
                  )
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ================================================================
            COLUMN 2: Recent Activity (1/3 width, scrollable)
            ================================================================ */}
        <div className="space-y-4">
          <Card className="h-[500px] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <ActivityTimeline
                activities={recentActivities}
                loading={recentLoading}
                emptyMessage="No recent activity yet"
              />
            </CardContent>
          </Card>
        </div>

        {/* ================================================================
            COLUMN 3: Upcoming Meetings & Quick Actions (1/3 width)
            ================================================================ */}
        <div className="space-y-6">
          {/* ---- Upcoming Meetings ---- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Upcoming Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meetingsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming meetings
                </p>
              ) : (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <p className="font-medium text-sm truncate">
                        {meeting.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(meeting.scheduled_at), 'MMM d, h:mm a')}
                        {meeting.duration_minutes
                          ? ` (${meeting.duration_minutes}min)`
                          : ''}
                      </p>
                      {meeting.person && (
                        <p className="text-xs text-muted-foreground">
                          {meeting.person.first_name} {meeting.person.last_name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---- Quick Actions ---- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => setLogActivityOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Log Activity
                </Button>
                <Button
                  className="flex-1"
                  size="sm"
                  variant="outline"
                  onClick={() => setBookMeetingOpen(true)}
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  Book Meeting
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {followUpCounts.overdue > 0 && (
                  <span className="text-red-600 font-medium">
                    {followUpCounts.overdue} overdue
                  </span>
                )}
                {followUpCounts.overdue > 0 && followUpCounts.today > 0 && ' · '}
                {followUpCounts.today > 0 && (
                  <span className="text-amber-600 font-medium">
                    {followUpCounts.today} today
                  </span>
                )}
                {(followUpCounts.overdue > 0 || followUpCounts.today > 0) &&
                  followUpCounts.upcoming > 0 &&
                  ' · '}
                {followUpCounts.upcoming > 0 && (
                  <span>{followUpCounts.upcoming} this week</span>
                )}
                {followUpCounts.overdue === 0 &&
                  followUpCounts.today === 0 &&
                  followUpCounts.upcoming === 0 &&
                  'No pending follow-ups'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Modals ---- */}
      <LogActivityModal
        open={logActivityOpen}
        onOpenChange={setLogActivityOpen}
        projectSlug={projectSlug}
        onSuccess={() => {
          loadFollowUps();
          refreshRecent();
        }}
      />
      <BookMeetingModal
        open={bookMeetingOpen}
        onOpenChange={setBookMeetingOpen}
        projectSlug={projectSlug}
        onSuccess={() => {
          loadMeetings();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Follow-Up List (extracted for clarity)
// ---------------------------------------------------------------------------

interface FollowUpListProps {
  loading: boolean;
  items: ActivityWithUser[];
  completingId: string | null;
  onComplete: (activity: ActivityWithUser, outcome: string) => void;
  getStatusIndicator: (activity: ActivityWithUser) => React.ReactNode;
  formatDueDate: (dateStr: string | null | undefined) => string | null;
}

function FollowUpList({
  loading,
  items,
  completingId,
  onComplete,
  getStatusIndicator,
  formatDueDate,
}: FollowUpListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          No follow-ups — log an activity to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((activity) => {
        const typeKey = activity.activity_type ?? 'task';
        const TypeIcon = activityTypeIcons[typeKey] ?? CheckSquare;
        const typeColor =
          activityTypeColors[typeKey] ?? 'text-gray-600 bg-gray-100';
        const dueDate =
          activity.follow_up_task?.due_date ?? activity.follow_up_date;
        const isCompleting = completingId === activity.id;
        const outcomes =
          ACTIVITY_TYPE_OUTCOMES[(activity.activity_type ?? 'call') as ActivityType] ?? [];

        return (
          <div
            key={activity.id}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/50 transition-colors"
          >
            {/* Activity type icon */}
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                typeColor
              )}
            >
              <TypeIcon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {activity.person
                    ? `${activity.person.first_name} ${activity.person.last_name}`
                    : 'Unknown'}
                </p>
                {activity.organization && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {activity.organization.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {activity.subject ?? 'No subject'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {activity.outcome && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0 h-4 border-0',
                      outcomeColors[activity.outcome] ?? 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {OUTCOME_LABELS[activity.outcome]}
                  </Badge>
                )}
                {dueDate && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDueDate(dueDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex-shrink-0">
              {getStatusIndicator(activity)}
            </div>

            {/* Complete with outcome */}
            {activity.follow_up_task?.status !== 'completed' && (
              <div className="flex-shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={isCompleting}
                    >
                      {isCompleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Done
                          <ChevronRight className="h-3 w-3" />
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-48 p-1">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Select outcome
                    </p>
                    {outcomes.map((outcomeKey) => (
                      <button
                        key={outcomeKey}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                        onClick={() => onComplete(activity, outcomeKey)}
                        disabled={isCompleting}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-4 border-0',
                            outcomeColors[outcomeKey] ?? 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {OUTCOME_LABELS[outcomeKey as ActivityOutcome]}
                        </Badge>
                      </button>
                    ))}
                    {outcomes.length === 0 && (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                        onClick={() => onComplete(activity, 'other')}
                        disabled={isCompleting}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        Mark Complete
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
