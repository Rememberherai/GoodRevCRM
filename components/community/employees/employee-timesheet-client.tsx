'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Download, LogIn, LogOut, Pencil, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  entry_source: string | null;
  jobs?: { id: string; title: string } | null;
}

interface EmployeeTimesheetClientProps {
  projectSlug: string;
  employeePersonId: string;
  employeeName: string;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sourceLabel(source: string | null) {
  switch (source) {
    case 'portal': return 'Portal';
    case 'kiosk': return 'Kiosk';
    case 'admin': return 'Admin';
    case 'job_tracker': return 'Job Tracker';
    case 'legacy': return 'Legacy';
    default: return '—';
  }
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(entries: TimeEntryRow[], employeeName: string) {
  const headers = ['Date', 'Clock In', 'Clock Out', 'Duration (min)', 'Source', 'Notes'];
  const rows = entries.map((e) => [
    csvField(new Date(e.started_at).toLocaleDateString()),
    csvField(formatTime(e.started_at)),
    csvField(e.ended_at ? formatTime(e.ended_at) : ''),
    String(e.duration_minutes ?? ''),
    csvField(sourceLabel(e.entry_source)),
    csvField(e.notes ?? ''),
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timesheet-${employeeName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface EditState {
  entryId: string;
  startedAt: string;
  endedAt: string;
  notes: string;
  saving: boolean;
}

export function EmployeeTimesheetClient({ projectSlug, employeePersonId, employeeName }: EmployeeTimesheetClientProps) {
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [openEntry, setOpenEntry] = useState<TimeEntryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [from, setFrom] = useState(() => startOfMonth(new Date()));
  const [to, setTo] = useState(() => endOfMonth(new Date()));
  const [editState, setEditState] = useState<EditState | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, limit: '200' });
      const res = await fetch(`/api/employee/${projectSlug}/punch?${params}`);
      const data = await res.json() as { entries?: TimeEntryRow[]; open_entry?: TimeEntryRow | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load timesheet');
      setEntries(data.entries ?? []);
      setOpenEntry(data.open_entry ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, employeePersonId, from, to]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const totalMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0),
    [entries]
  );

  async function handlePunch() {
    setPunching(true);
    try {
      const res = await fetch(`/api/employee/${projectSlug}/punch`, { method: 'POST' });
      const data = await res.json() as { action?: string; entry?: TimeEntryRow; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to punch');
      if (data.action === 'in') {
        toast.success('Clocked in');
      } else {
        const dur = data.entry?.duration_minutes;
        toast.success(`Clocked out${dur != null ? ` — ${formatDuration(dur)} logged` : ''}`);
      }
      await loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Punch failed');
    } finally {
      setPunching(false);
    }
  }

  function startEdit(entry: TimeEntryRow) {
    setEditState({
      entryId: entry.id,
      startedAt: toDatetimeLocal(entry.started_at),
      endedAt: entry.ended_at ? toDatetimeLocal(entry.ended_at) : '',
      notes: entry.notes ?? '',
      saving: false,
    });
  }

  async function saveEdit() {
    if (!editState) return;
    setEditState((prev) => prev ? { ...prev, saving: true } : null);
    try {
      const body: Record<string, unknown> = {
        started_at: new Date(editState.startedAt).toISOString(),
        notes: editState.notes || null,
      };
      if (editState.endedAt) {
        body.ended_at = new Date(editState.endedAt).toISOString();
      }
      // Do not send ended_at: null — employee self-correction cannot re-open a completed entry
      const res = await fetch(`/api/employee/${projectSlug}/entries/${editState.entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { entry?: TimeEntryRow; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to update entry');
      toast.success('Entry updated');
      setEditState(null);
      await loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
      setEditState((prev) => prev ? { ...prev, saving: false } : null);
    }
  }

  const isClockedIn = openEntry != null;

  return (
    <div className="space-y-6">
      {/* Status banner + punch button */}
      <div className={`rounded-xl border p-6 ${isClockedIn ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'bg-card'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {isClockedIn
                ? `Clocked in since ${formatTime(openEntry.started_at)}`
                : 'Not clocked in'}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isClockedIn ? 'Your shift is active.' : 'Press Clock In to start your shift.'}
            </p>
          </div>
          <Button
            size="lg"
            variant={isClockedIn ? 'outline' : 'default'}
            onClick={() => void handlePunch()}
            disabled={punching}
            className="shrink-0"
          >
            {isClockedIn ? (
              <><LogOut className="mr-2 h-4 w-4" />Clock Out</>
            ) : (
              <><LogIn className="mr-2 h-4 w-4" />Clock In</>
            )}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Hours This Period</div>
          <div className="mt-2 text-2xl font-bold">{formatDuration(totalMinutes)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Entries</div>
          <div className="mt-2 text-2xl font-bold">{entries.length}</div>
        </div>
      </div>

      {/* Entries table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Time Entries</CardTitle>
              <CardDescription>Your punch records for the selected period. Same-day entries can be corrected.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Label htmlFor="ets-from" className="sr-only">From</Label>
                <Input id="ets-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
                <span className="text-muted-foreground">—</span>
                <Label htmlFor="ets-to" className="sr-only">To</Label>
                <Input id="ets-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36 text-xs" />
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(entries, employeeName)} disabled={entries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No time entries for this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Date</th>
                    <th className="pb-2 pr-4 text-left font-medium">In</th>
                    <th className="pb-2 pr-4 text-left font-medium">Out</th>
                    <th className="pb-2 pr-4 text-right font-medium">Hours</th>
                    <th className="pb-2 pr-4 text-left font-medium">Source</th>
                    <th className="pb-2 pr-4 text-left font-medium">Notes</th>
                    <th className="pb-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => {
                    const canEdit = isToday(entry.started_at) && !entry.jobs && entry.ended_at != null;
                    const isEditing = editState?.entryId === entry.id;

                    if (isEditing && editState) {
                      return (
                        <tr key={entry.id} className="bg-muted/30">
                          <td colSpan={7} className="py-3 px-2">
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs">Clock In</Label>
                                <Input
                                  type="datetime-local"
                                  value={editState.startedAt}
                                  onChange={(e) => setEditState((s) => s ? { ...s, startedAt: e.target.value } : null)}
                                  className="h-8 text-xs w-52"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs">Clock Out</Label>
                                <Input
                                  type="datetime-local"
                                  value={editState.endedAt}
                                  onChange={(e) => setEditState((s) => s ? { ...s, endedAt: e.target.value } : null)}
                                  className="h-8 text-xs w-52"
                                />
                              </div>
                              <div className="flex flex-col gap-1 flex-1 min-w-40">
                                <Label className="text-xs">Notes</Label>
                                <Textarea
                                  value={editState.notes}
                                  onChange={(e) => setEditState((s) => s ? { ...s, notes: e.target.value } : null)}
                                  rows={1}
                                  className="text-xs min-h-[32px]"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => void saveEdit()} disabled={editState.saving}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditState(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={entry.id}>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(entry.started_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{formatTime(entry.started_at)}</td>
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                          {entry.ended_at ? formatTime(entry.ended_at) : (
                            <span className="text-green-600 text-xs font-medium">Running</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium tabular-nums">
                          {entry.duration_minutes != null ? formatDuration(entry.duration_minutes) : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="text-xs">
                            {sourceLabel(entry.entry_source)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 max-w-xs truncate text-muted-foreground">{entry.notes ?? ''}</td>
                        <td className="py-2 text-right">
                          {canEdit && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(entry)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
