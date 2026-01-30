'use client';

import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Assignee {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface UpcomingTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee: Assignee | null;
}

interface UpcomingTasksProps {
  tasks: UpcomingTask[];
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

function getDueDateInfo(dueDate: string | null) {
  if (!dueDate) return null;

  const date = parseISO(dueDate);

  if (isPast(date) && !isToday(date)) {
    return { label: 'Overdue', isOverdue: true };
  }
  if (isToday(date)) {
    return { label: 'Today', isOverdue: false };
  }
  if (isTomorrow(date)) {
    return { label: 'Tomorrow', isOverdue: false };
  }
  return { label: format(date, 'MMM d'), isOverdue: false };
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

export function UpcomingTasks({ tasks }: UpcomingTasksProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Tasks</CardTitle>
        <CardDescription>Tasks due soon</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming tasks
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const dueDateInfo = getDueDateInfo(task.due_date);

              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <Badge
                        variant="secondary"
                        className={priorityColors[task.priority] ?? ''}
                      >
                        {task.priority}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="capitalize">{task.status.replace('_', ' ')}</span>

                      {dueDateInfo && (
                        <span
                          className={cn(
                            'flex items-center gap-1',
                            dueDateInfo.isOverdue && 'text-red-600 font-medium'
                          )}
                        >
                          {dueDateInfo.isOverdue ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <Calendar className="h-3 w-3" />
                          )}
                          {dueDateInfo.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {task.assignee && (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignee.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(task.assignee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
