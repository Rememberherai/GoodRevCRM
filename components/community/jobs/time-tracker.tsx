'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play, Square, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface TimeEntry {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_break: boolean;
  duration_minutes: number | null;
  notes: string | null;
}

interface TimeTrackerProps {
  slug: string;
  jobId: string;
  initialStatus?: string | null;
  onRefresh?: () => void | Promise<void>;
}

function formatElapsed(startedAt: string) {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TimeTracker({ slug, jobId, initialStatus, onRefresh }: TimeTrackerProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(initialStatus ?? 'assigned');
  const [completionNotes, setCompletionNotes] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (initialStatus) setStatus(initialStatus);
  }, [initialStatus]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/jobs/${jobId}/time-entries`);
      const data = await response.json() as { entries?: TimeEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load time entries');
      setEntries(data.entries ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [jobId, slug]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const activeEntry = entries.find((entry) => !entry.ended_at) ?? null;

  useEffect(() => {
    if (!activeEntry) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [activeEntry]);

  const totalMinutes = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0),
    [entries]
  );

  const refreshAll = async (nextStatus?: string) => {
    if (nextStatus) setStatus(nextStatus);
    await loadEntries();
    await onRefresh?.();
  };

  const doStopActive = async (entryId: string) => {
    const response = await fetch(`/api/projects/${slug}/jobs/${jobId}/time-entries`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_entry_id: entryId,
        ended_at: new Date().toISOString(),
      }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Failed to stop timer');
  };

  const doStartEntry = async (isBreak: boolean) => {
    const response = await fetch(`/api/projects/${slug}/jobs/${jobId}/time-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        started_at: new Date().toISOString(),
        is_break: isBreak,
      }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Failed to start timer');
  };

  const startEntry = async (isBreak: boolean) => {
    setSubmitting(true);
    try {
      await doStartEntry(isBreak);
      await refreshAll(isBreak ? 'paused' : 'in_progress');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start timer');
    } finally {
      setSubmitting(false);
    }
  };

  const stopActive = async (nextStatus?: string) => {
    if (!activeEntry) return;
    setSubmitting(true);
    try {
      await doStopActive(activeEntry.id);
      await refreshAll(nextStatus ?? 'accepted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to stop timer');
    } finally {
      setSubmitting(false);
    }
  };

  const pauseForBreak = async () => {
    if (!activeEntry) return;
    setSubmitting(true);
    try {
      await doStopActive(activeEntry.id);
      await doStartEntry(true);
      await refreshAll('paused');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to pause');
    } finally {
      setSubmitting(false);
    }
  };

  const resumeFromBreak = async () => {
    if (!activeEntry) return;
    setSubmitting(true);
    try {
      await doStopActive(activeEntry.id);
      await doStartEntry(false);
      await refreshAll('in_progress');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume');
    } finally {
      setSubmitting(false);
    }
  };

  const completeJob = async () => {
    setSubmitting(true);
    try {
      if (activeEntry) {
        await doStopActive(activeEntry.id);
      }

      const response = await fetch(`/api/projects/${slug}/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: completionNotes || null,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to complete job');
      toast.success('Job completed');
      setCompletionNotes('');
      await refreshAll('completed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Tracking</CardTitle>
        <CardDescription>Start, pause, stop, and complete contractor work from one place.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
                <div className="mt-2 text-lg font-semibold capitalize">{status.replace(/_/g, ' ')}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Logged</div>
                <div className="mt-2 text-lg font-semibold">
                  {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {activeEntry?.is_break ? 'Break Running' : 'Live Clock'}
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {activeEntry ? formatElapsed(activeEntry.started_at) : '00:00:00'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!activeEntry && status !== 'completed' && (
                <Button onClick={() => void startEntry(false)} disabled={submitting}>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </Button>
              )}

              {activeEntry && !activeEntry.is_break && status !== 'completed' && (
                <>
                  <Button variant="secondary" onClick={() => void pauseForBreak()} disabled={submitting}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause for Break
                  </Button>
                  <Button variant="outline" onClick={() => void stopActive('accepted')} disabled={submitting}>
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                </>
              )}

              {activeEntry?.is_break && status !== 'completed' && (
                <Button variant="secondary" onClick={() => void resumeFromBreak()} disabled={submitting}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}

              {status !== 'completed' && (
                <Button variant="default" onClick={() => void completeJob()} disabled={submitting}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Job
                </Button>
              )}
            </div>

            {status !== 'completed' && (
              <Textarea
                value={completionNotes}
                onChange={(event) => setCompletionNotes(event.target.value)}
                placeholder="Completion notes or field notes"
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
