'use client';

import { useState } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  Clock,
  MoreHorizontal,
  Plus,
  Calendar,
  AlertCircle,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/task';

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onStatusChange?: (taskId: string, completed: boolean) => void;
  onCreateTask?: () => void;
  showCreateButton?: boolean;
  emptyMessage?: string;
}

const priorityConfig = {
  urgent: { label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-700' },
  high: { label: 'High', color: 'bg-orange-500', textColor: 'text-orange-700' },
  medium: { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
  low: { label: 'Low', color: 'bg-green-500', textColor: 'text-green-700' },
};

const statusConfig: Record<string, { label: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', icon: Circle },
  todo: { label: 'To Do', icon: Circle },
  in_progress: { label: 'In Progress', icon: Clock },
  completed: { label: 'Completed', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', icon: Circle },
};

function getDueDateLabel(dueDate: string | null): { label: string; isOverdue: boolean } | null {
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

export function TaskList({
  tasks,
  onTaskClick,
  onStatusChange,
  onCreateTask,
  showCreateButton = true,
  emptyMessage = 'No tasks yet',
}: TaskListProps) {
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set());

  const handleStatusToggle = async (task: Task) => {
    if (!onStatusChange) return;

    setUpdatingTasks((prev) => new Set(prev).add(task.id));
    try {
      await onStatusChange(task.id, task.status !== 'completed');
    } finally {
      setUpdatingTasks((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <Circle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">{emptyMessage}</p>
        {showCreateButton && onCreateTask && (
          <Button variant="outline" className="mt-4" onClick={onCreateTask}>
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showCreateButton && onCreateTask && (
        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={onCreateTask}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      )}

      {tasks.map((task) => {
        const dueDateInfo = getDueDateLabel(task.due_date);
        const StatusIcon = statusConfig[task.status]?.icon ?? Circle;
        const priority = priorityConfig[task.priority];
        const isUpdating = updatingTasks.has(task.id);

        return (
          <div
            key={task.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
              task.status === 'completed' && 'opacity-60'
            )}
          >
            <Checkbox
              checked={task.status === 'completed'}
              disabled={isUpdating}
              onCheckedChange={() => handleStatusToggle(task)}
              className="mt-1"
            />

            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onTaskClick?.(task)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-medium truncate',
                    task.status === 'completed' && 'line-through text-muted-foreground'
                  )}
                >
                  {task.title}
                </span>
                {priority && (
                  <Badge
                    variant="outline"
                    className={cn('text-xs', priority.textColor)}
                  >
                    {priority.label}
                  </Badge>
                )}
              </div>

              {task.description && (
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig[task.status]?.label}
                </span>

                {dueDateInfo && (
                  <span
                    className={cn(
                      'flex items-center gap-1',
                      dueDateInfo.isOverdue && 'text-red-600'
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

                {task.assignee && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {task.assignee.full_name}
                  </span>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTaskClick?.(task)}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusToggle(task)}>
                  {task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
