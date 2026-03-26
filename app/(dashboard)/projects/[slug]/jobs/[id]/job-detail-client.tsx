'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeTracker } from '@/components/community/jobs/time-tracker';

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_break: boolean;
  duration_minutes: number | null;
  notes: string | null;
}

interface JobDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  desired_start: string | null;
  deadline: string | null;
  service_address: string | null;
  service_category: string | null;
  required_certifications: string[] | null;
  is_out_of_scope: boolean;
  notes: string | null;
  contractor?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  scope?: {
    id: string;
    title: string | null;
    status: string | null;
  } | null;
  time_entries?: TimeEntryRow[];
}

interface EditDraft {
  started_at: string;
  ended_at: string;
  notes: string;
}

const TERMINAL_STATUSES = ['completed', 'declined', 'pulled', 'cancelled'];

export function JobDetailClient({ jobId }: { jobId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState<EditDraft>({ started_at: '', ended_at: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadJob = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/jobs/${jobId}`);
      const data = await response.json() as { job?: JobDetail; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? 'Failed to load job');
      setJob(data.job);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId, slug]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const totalMinutes = useMemo(
    () => (job?.time_entries ?? []).reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0),
    [job]
  );

  const runAction = async (action: 'accept' | 'decline' | 'pull' | 'complete') => {
    try {
      let body: Record<string, unknown> = {};
      if (action === 'decline') {
        const reason = window.prompt('Why is this job being declined?');
        if (reason === null) return;
        body = { reason };
      }
      if (action === 'accept') {
        body = { desired_start: job?.desired_start ?? null };
      }
      if (action === 'complete') {
        body = { notes: job?.notes ?? null };
      }

      const response = await fetch(`/api/projects/${slug}/jobs/${jobId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Failed to ${action} job`);
      const pastTense: Record<string, string> = { accept: 'accepted', decline: 'declined', pull: 'pulled', complete: 'completed' };
      toast.success(`Job ${pastTense[action] ?? action}`);
      await loadJob();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : `Failed to ${action} job`);
    }
  };

  const toLocalDatetimeInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const startEditing = (entry: TimeEntryRow) => {
    setEditingEntryId(entry.id);
    setEditDraft({
      started_at: toLocalDatetimeInput(entry.started_at),
      ended_at: entry.ended_at ? toLocalDatetimeInput(entry.ended_at) : '',
      notes: entry.notes ?? '',
    });
  };

  const saveEdit = async (entryId: string) => {
    if (!editDraft) return;
    if (editDraft.ended_at) {
      const s = new Date(`${editDraft.started_at.slice(0, 16)}:00`);
      const e = new Date(`${editDraft.ended_at.slice(0, 16)}:00`);
      if (e <= s) { toast.error('End time must be after start time'); return; }
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/time-entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          started_at: new Date(`${editDraft.started_at.slice(0, 16)}:00`).toISOString(),
          ended_at: editDraft.ended_at ? new Date(`${editDraft.ended_at.slice(0, 16)}:00`).toISOString() : null,
          notes: editDraft.notes || null,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to update entry');
      toast.success('Time entry updated');
      setEditingEntryId(null);
      setEditDraft(null);
      await loadJob();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      const response = await fetch(`/api/projects/${slug}/time-entries/${entryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to delete entry');
      }
      toast.success('Time entry deleted');
      await loadJob();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const addEntry = async () => {
    if (!newEntry.started_at || !newEntry.ended_at) {
      toast.error('Start and end times are required');
      return;
    }
    const s = new Date(`${newEntry.started_at.slice(0, 16)}:00`);
    const e = new Date(`${newEntry.ended_at.slice(0, 16)}:00`);
    if (e <= s) { toast.error('End time must be after start time'); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${slug}/jobs/${jobId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          started_at: new Date(`${newEntry.started_at.slice(0, 16)}:00`).toISOString(),
          ended_at: new Date(`${newEntry.ended_at.slice(0, 16)}:00`).toISOString(),
          is_break: false,
          notes: newEntry.notes || null,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to add entry');
      toast.success('Time entry added');
      setAddingEntry(false);
      setNewEntry({ started_at: '', ended_at: '', notes: '' });
      await loadJob();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/projects/${slug}/jobs`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? 'Job not found'}
        </div>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATUSES.includes(job.status);

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="px-0">
        <Link href={`/projects/${slug}/jobs`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{job.title}</h2>
            <div className="text-sm text-muted-foreground">
              {job.contractor
                ? [job.contractor.first_name, job.contractor.last_name].filter(Boolean).join(' ')
                : 'Unassigned job'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{job.status.replace(/_/g, ' ')}</Badge>
          <Badge variant="outline">{job.priority}</Badge>
          {job.is_out_of_scope && <Badge variant="destructive">Out of scope</Badge>}
          {job.scope?.title && <Badge variant="outline">Scope: {job.scope.title}</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {job.status === 'assigned' && (
          <Button onClick={() => void runAction('accept')}>Accept</Button>
        )}
        {job.status === 'assigned' && (
          <Button variant="secondary" onClick={() => void runAction('decline')}>Decline</Button>
        )}
        {job.contractor && job.status !== 'pulled' && job.status !== 'completed' && (
          <Button variant="outline" onClick={() => void runAction('pull')}>Pull Job</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Desired Start" value={job.desired_start ? new Date(job.desired_start).toLocaleString() : 'Not set'} />
        <InfoCard label="Deadline" value={job.deadline ? new Date(job.deadline).toLocaleString() : 'Not set'} />
        <InfoCard label="Logged Time" value={`${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <CardDescription>Scope fit, notes, required certifications, and field instructions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <DetailRow label="Description" value={job.description || 'No description provided.'} />
          <DetailRow label="Service Category" value={job.service_category || 'Not set'} />
          <DetailRow label="Service Address" value={job.service_address || 'Not set'} />
          <DetailRow label="Required Certifications" value={(job.required_certifications ?? []).join(', ') || 'None'} />
          <DetailRow label="Notes" value={job.notes || 'No notes yet.'} />
        </CardContent>
      </Card>

      {!isTerminal && (
        <TimeTracker slug={slug} jobId={job.id} initialStatus={job.status} onRefresh={loadJob} />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Time Entry History</CardTitle>
              <CardDescription>All logged time for this job. Edit or delete individual entries.</CardDescription>
            </div>
            {job.contractor && !isTerminal && !addingEntry && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAddingEntry(true);
                  setNewEntry({ started_at: '', ended_at: '', notes: '' });
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingEntry && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-3">
              <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">New Entry</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Start</div>
                  <Input
                    type="datetime-local"
                    value={newEntry.started_at}
                    onChange={(e) => setNewEntry((d) => ({ ...d, started_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">End</div>
                  <Input
                    type="datetime-local"
                    value={newEntry.ended_at}
                    onChange={(e) => setNewEntry((d) => ({ ...d, ended_at: e.target.value }))}
                  />
                </div>
              </div>
              <Textarea
                placeholder="Notes (optional)"
                value={newEntry.notes}
                onChange={(e) => setNewEntry((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void addEntry()} disabled={saving}>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingEntry(false)} disabled={saving}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {(job.time_entries ?? []).length === 0 && !addingEntry ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No time entries yet.
            </div>
          ) : (
            (job.time_entries ?? []).map((entry) => (
              <div key={entry.id} className="rounded-lg border p-4 text-sm">
                {editingEntryId === entry.id && editDraft ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Start</div>
                        <Input
                          type="datetime-local"
                          value={editDraft.started_at}
                          onChange={(e) => setEditDraft((d) => d ? { ...d, started_at: e.target.value } : d)}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">End</div>
                        <Input
                          type="datetime-local"
                          value={editDraft.ended_at}
                          onChange={(e) => setEditDraft((d) => d ? { ...d, ended_at: e.target.value } : d)}
                        />
                      </div>
                    </div>
                    <Textarea
                      placeholder="Notes (optional)"
                      value={editDraft.notes}
                      onChange={(e) => setEditDraft((d) => d ? { ...d, notes: e.target.value } : d)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void saveEdit(entry.id)} disabled={saving}>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingEntryId(null); setEditDraft(null); }}
                        disabled={saving}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {entry.is_break ? 'Break' : 'Work'} — {new Date(entry.started_at).toLocaleString()}
                        {entry.ended_at && ` → ${new Date(entry.ended_at).toLocaleString()}`}
                      </div>
                      {entry.notes && <div className="text-muted-foreground">{entry.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">
                        {entry.duration_minutes != null
                          ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m`
                          : 'Running'}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEditing(entry)}
                        title="Edit entry"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => void deleteEntry(entry.id)}
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {(job.time_entries ?? []).length > 0 && (
            <div className="rounded-lg bg-muted/50 px-4 py-2 text-sm font-medium">
              Total: {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{value}</CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
