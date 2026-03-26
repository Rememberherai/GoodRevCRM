'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogTimeDialog } from '@/components/community/contractors/log-time-dialog';

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_break: boolean;
  duration_minutes: number | null;
  category: string | null;
  notes: string | null;
  jobs?: { id: string; title: string } | null;
}

interface ContractorTimesheetClientProps {
  projectSlug: string;
  contractorPersonId: string;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function formatDateTimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function downloadCsv(entries: TimeEntryRow[]) {
  const headers = ['Date', 'Start', 'End', 'Job', 'Category', 'Type', 'Duration (minutes)', 'Notes'];
  const rows = entries.map((entry) => {
    const date = new Date(entry.started_at).toLocaleDateString();
    const start = formatDateTimeLocal(entry.started_at);
    const end = entry.ended_at ? formatDateTimeLocal(entry.ended_at) : '';
    const job = entry.jobs?.title ?? 'Standalone';
    const category = entry.category ?? '';
    const type = entry.is_break ? 'Break' : 'Work';
    const duration = String(entry.duration_minutes ?? '');
    const notes = entry.notes ?? '';
    return [csvField(date), csvField(start), csvField(end), csvField(job), csvField(category), type, duration, csvField(notes)].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-timesheet-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContractorTimesheetClient({ projectSlug, contractorPersonId }: ContractorTimesheetClientProps) {
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogTime, setShowLogTime] = useState(false);
  const [from, setFrom] = useState(() => startOfMonth(new Date()));
  const [to, setTo] = useState(() => endOfMonth(new Date()));

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        contractor_id: contractorPersonId,
        from,
        to,
        limit: '200',
      });
      const response = await fetch(`/api/projects/${projectSlug}/time-entries?${params}`);
      const data = await response.json() as { entries?: TimeEntryRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load timesheet');
      setEntries(data.entries ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, contractorPersonId, from, to]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const workMinutes = useMemo(
    () => entries.filter((e) => !e.is_break).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0),
    [entries]
  );
  const breakMinutes = useMemo(
    () => entries.filter((e) => e.is_break).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0),
    [entries]
  );
  const workEntryCount = useMemo(() => entries.filter((e) => !e.is_break).length, [entries]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-3xl font-bold tracking-tight">My Timesheet</h2>
        <p className="mt-1 text-muted-foreground">
          View and export all your logged hours. Use the date range to filter by period.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Hours Worked</div>
          <div className="mt-2 text-2xl font-bold">{Math.floor(workMinutes / 60)}h {workMinutes % 60}m</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Break Time</div>
          <div className="mt-2 text-2xl font-bold">{Math.floor(breakMinutes / 60)}h {breakMinutes % 60}m</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Work Entries</div>
          <div className="mt-2 text-2xl font-bold">{workEntryCount}</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Time Entries</CardTitle>
              <CardDescription>All your logged work and breaks for the selected period.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Label htmlFor="cts-from" className="sr-only">From</Label>
                <Input
                  id="cts-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <span className="text-muted-foreground">—</span>
                <Label htmlFor="cts-to" className="sr-only">To</Label>
                <Input
                  id="cts-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(entries)} disabled={entries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button size="sm" onClick={() => setShowLogTime(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Log Time
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
              <Button className="mt-4" size="sm" onClick={() => setShowLogTime(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Log Time
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Date</th>
                    <th className="pb-2 pr-4 text-left font-medium">Job</th>
                    <th className="pb-2 pr-4 text-left font-medium">Category</th>
                    <th className="pb-2 pr-4 text-left font-medium">Type</th>
                    <th className="pb-2 pr-4 text-right font-medium">Duration</th>
                    <th className="pb-2 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(entry.started_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">
                        {entry.jobs?.title ?? <span className="italic text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{entry.category ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={entry.is_break ? 'secondary' : 'outline'} className="text-xs">
                          {entry.is_break ? 'Break' : 'Work'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right font-medium tabular-nums">
                        {entry.duration_minutes != null
                          ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m`
                          : <span className="text-amber-600 text-xs">Running</span>}
                      </td>
                      <td className="py-2 text-muted-foreground max-w-xs truncate">{entry.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LogTimeDialog
        open={showLogTime}
        onOpenChange={setShowLogTime}
        projectSlug={projectSlug}
        contractorPersonId={contractorPersonId}
        mode="portal"
        onCreated={() => void loadEntries()}
      />
    </div>
  );
}
