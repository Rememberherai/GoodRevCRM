'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, KeyRound, Download, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EmployeePerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  job_title: string | null;
  user_id: string | null;
  pin_set?: boolean;
}

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  entry_source: string | null;
  jobs?: { id: string; title: string } | null;
}

interface EmployeeDetailClientProps {
  employeeId: string;
  projectSlug?: string;
  initialPerson?: EmployeePerson | null;
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

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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

function downloadCsv(entries: TimeEntryRow[], name: string) {
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
  a.download = `timesheet-${name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
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

interface PinDialogState {
  open: boolean;
  pin: string;
  saving: boolean;
}

export function EmployeeDetailClient({ employeeId, projectSlug, initialPerson }: EmployeeDetailClientProps) {
  const params = useParams();
  const slug = projectSlug ?? (params.slug as string);

  const [employee, setEmployee] = useState<EmployeePerson | null>(initialPerson ?? null);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => startOfMonth(new Date()));
  const [to, setTo] = useState(() => endOfMonth(new Date()));
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pinDialog, setPinDialog] = useState<PinDialogState>({ open: false, pin: '', saving: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const entriesRes = await fetch(`/api/projects/${slug}/time-entries?person_id=${employeeId}&from=${from}&to=${to}&limit=200`);
      const entriesData = await entriesRes.json() as { entries?: TimeEntryRow[]; error?: string };
      if (!entriesRes.ok) throw new Error(entriesData.error ?? 'Failed to load entries');
      setEntries((entriesData.entries ?? []).filter((entry) => !entry.jobs));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [slug, employeeId, from, to]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalMinutes = useMemo(
    () => entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0),
    [entries]
  );

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
    setEditState((s) => s ? { ...s, saving: true } : null);
    try {
      const body: Record<string, unknown> = {
        started_at: new Date(editState.startedAt).toISOString(),
        notes: editState.notes || null,
      };
      if (editState.endedAt) {
        body.ended_at = new Date(editState.endedAt).toISOString();
      } else {
        body.ended_at = null;
      }
      const res = await fetch(`/api/projects/${slug}/time-entries/${editState.entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to update entry');
      toast.success('Entry updated');
      setEditState(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
      setEditState((s) => s ? { ...s, saving: false } : null);
    }
  }

  async function deleteEntry(entryId: string) {
    try {
      const res = await fetch(`/api/projects/${slug}/time-entries/${entryId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to delete entry');
      }
      toast.success('Entry deleted');
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function savePin() {
    if (!pinDialog.pin.match(/^\d{4}$/)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    setPinDialog((d) => ({ ...d, saving: true }));
    try {
      const res = await fetch(`/api/projects/${slug}/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_pin: pinDialog.pin }),
      });
      const data = await res.json() as { employee?: { pin_set: boolean }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to set PIN');
      toast.success('PIN updated');
      setPinDialog({ open: false, pin: '', saving: false });
      // Update pin_set on the local employee record without a re-fetch
      if (data.employee) {
        setEmployee((prev) => prev ? { ...prev, pin_set: data.employee!.pin_set } : prev);
      }
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set PIN');
      setPinDialog((d) => ({ ...d, saving: false }));
    }
  }

  const displayName = employee ? ([employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'Unnamed') : '…';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/projects/${slug}/employees`} className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Employees
        </Link>
      </div>

      {/* Employee info card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          {employee?.job_title && (
            <p className="mt-0.5 text-sm text-muted-foreground">{employee.job_title}</p>
          )}
          {employee && (
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {employee.email && <span>{employee.email}</span>}
              {employee.phone && <span>{employee.phone}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPinDialog({ open: true, pin: '', saving: false })}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {employee?.pin_set ? 'Reset PIN' : 'Set PIN'}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/projects/${slug}/people/${employeeId}`}>
              View Contact
            </Link>
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

      {/* Time entries */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Time Entries</CardTitle>
              <CardDescription>All punch records for this employee. Edits are audit-logged.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Label htmlFor="ede-from" className="sr-only">From</Label>
                <Input id="ede-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
                <span className="text-muted-foreground">—</span>
                <Label htmlFor="ede-to" className="sr-only">To</Label>
                <Input id="ede-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36 text-xs" />
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(entries, displayName)} disabled={entries.length === 0}>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(entry)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm != null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Time Entry</DialogTitle>
            <DialogDescription>
              This will permanently delete the time entry. This action is audit-logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && void deleteEntry(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN dialog */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => !open && setPinDialog({ open: false, pin: '', saving: false })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Kiosk PIN</DialogTitle>
            <DialogDescription>
              Assign a 4-digit kiosk PIN to <strong>{displayName}</strong>. The raw PIN is never stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="detail-pin">4-Digit PIN</Label>
              <Input
                id="detail-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="••••"
                value={pinDialog.pin}
                onChange={(e) => setPinDialog((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialog({ open: false, pin: '', saving: false })} disabled={pinDialog.saving}>
              Cancel
            </Button>
            <Button onClick={() => void savePin()} disabled={pinDialog.saving || pinDialog.pin.length !== 4}>
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
