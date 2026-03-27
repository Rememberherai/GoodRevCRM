'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskList } from '@/components/tasks/task-list';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import { toast } from 'sonner';
import type { Task } from '@/types/task';

interface GrantTasksTabProps {
  grantId: string;
  projectSlug: string;
}

export function GrantTasksTab({ grantId, projectSlug }: GrantTasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/tasks?grant_id=${grantId}&limit=100`);
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json() as { tasks?: Task[] };
      setTasks(data.tasks ?? []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [grantId, projectSlug]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, completed: boolean) => {
    const newStatus = completed ? 'completed' : 'pending';
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t));
    try {
      const res = await fetch(`/api/projects/${projectSlug}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task');
    } catch {
      toast.error('Failed to update task');
      fetchTasks(); // revert
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Grant Tasks</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : (
        <TaskList
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onCreateTask={() => setCreateOpen(true)}
          showCreateButton={tasks.length === 0}
          emptyMessage="No tasks for this grant yet"
        />
      )}

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectSlug={projectSlug}
        grantId={grantId}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
