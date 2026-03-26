'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogTimeDialog } from '@/components/community/contractors/log-time-dialog';

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  is_break: boolean;
  duration_minutes: number | null;
  category: string | null;
  notes: string | null;
  contractor_id: string | null;
  job_id: string | null;
  jobs?: { id: string; title: string } | null;
  contractor?: { id: string; first_name: string | null; last_name: string | null } | null;
}

interface ContractorOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface JobOption {
  id: string;
  title: string;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function formatDateTimeLocal(iso: string) {
  // Format: YYYY-MM-DD HH:mm (human-readable, not UTC-shifted)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(entries: TimeEntryRow[]) {
  const headers = ['Contractor', 'Job', 'Date', 'Start', 'End', 'Duration (minutes)', 'Type', 'Category', 'Notes'];
  const rows = entries.map((entry) => {
    const contractor = entry.contractor
      ? [entry.contractor.first_name, entry.contractor.last_name].filter(Boolean).join(' ')
      : '';
    const job = entry.jobs?.title ?? 'Standalone';
    const date = new Date(entry.started_at).toLocaleDateString();
    const start = formatDateTimeLocal(entry.started_at);
    const end = entry.ended_at ? formatDateTimeLocal(entry.ended_at) : '';
    const duration = String(entry.duration_minutes ?? '');
    const type = entry.is_break ? 'Break' : 'Work';
    const category = entry.category ?? '';
    const notes = entry.notes ?? '';
    return [csvField(contractor), csvField(job), csvField(date), csvField(start), csvField(end), duration, type, csvField(category), csvField(notes)].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timesheets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TimesheetsPageClient() {
  const params = useParams();
  const slug = params.slug as string;

  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [showLogTime, setShowLogTime] = useState(false);
  const [logTimeContractorId, setLogTimeContractorId] = useState<string | null>(null);

  const [filterContractorId, setFilterContractorId] = useState('');
  const [filterJobId, setFilterJobId] = useState('');
  const [filterFrom, setFilterFrom] = useState(() => startOfMonth(new Date()));
  const [filterTo, setFilterTo] = useState(() => endOfMonth(new Date()));
  const [filterCategory, setFilterCategory] = useState('');

  // Load contractors for filter dropdown
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/contractors`);
        const data = await response.json() as { contractors?: ContractorOption[] };
        setContractors(data.contractors ?? []);
      } catch { /* non-fatal */ }
    })();
  }, [slug]);

  // Load jobs for filter dropdown
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/jobs`);
        const data = await response.json() as { jobs?: JobOption[] };
        setJobs(data.jobs ?? []);
      } catch { /* non-fatal */ }
    })();
  }, [slug]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ from: filterFrom, to: filterTo, limit: '200' });
      if (filterContractorId) queryParams.set('contractor_id', filterContractorId);
      if (filterJobId) queryParams.set('job_id', filterJobId);
      const response = await fetch(`/api/projects/${slug}/time-entries?${queryParams}`);
      const data = await response.json() as { entries?: TimeEntryRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load entries');
      let filtered = data.entries ?? [];
      if (filterCategory.trim()) {
        const term = filterCategory.trim().toLowerCase();
        filtered = filtered.filter((e) => (e.category ?? '').toLowerCase().includes(term));
      }
      setEntries(filtered);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setLoading(false);
    }
  }, [slug, filterContractorId, filterJobId, filterFrom, filterTo, filterCategory]);

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

  const openAddEntry = () => {
    // Use the active contractor filter if set; otherwise require the user to filter first
    const targetId = filterContractorId || contractors[0]?.id || null;
    if (!targetId) return;
    setLogTimeContractorId(targetId);
    setShowLogTime(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheets</h2>
          <p className="text-sm text-muted-foreground">All contractor time entries across jobs and standalone work.</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1 min-w-40">
              <Label className="text-xs">Contractor</Label>
              <Select value={filterContractorId || '__all__'} onValueChange={(v) => setFilterContractorId(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All contractors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All contractors</SelectItem>
                  {contractors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 min-w-40">
              <Label className="text-xs">Job</Label>
              <Select value={filterJobId || '__all__'} onValueChange={(v) => setFilterJobId(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All jobs</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ts-from" className="text-xs">From</Label>
              <Input id="ts-from" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ts-to" className="text-xs">To</Label>
              <Input id="ts-to" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
            <div className="space-y-1 min-w-32">
              <Label htmlFor="ts-category" className="text-xs">Category</Label>
              <Input id="ts-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} placeholder="Filter…" className="h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Time Entries</CardTitle>
              <CardDescription>
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} —{' '}
                {Math.floor(workMinutes / 60)}h {workMinutes % 60}m work,{' '}
                {Math.floor(breakMinutes / 60)}h {breakMinutes % 60}m break
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadCsv(entries)} disabled={entries.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                size="sm"
                onClick={openAddEntry}
                disabled={contractors.length === 0 || (contractors.length > 1 && !filterContractorId)}
                title={contractors.length > 1 && !filterContractorId ? 'Filter by a contractor first' : undefined}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No time entries found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Contractor</th>
                    <th className="pb-2 pr-4 text-left font-medium">Job</th>
                    <th className="pb-2 pr-4 text-left font-medium">Date</th>
                    <th className="pb-2 pr-4 text-left font-medium">Start</th>
                    <th className="pb-2 pr-4 text-left font-medium">End</th>
                    <th className="pb-2 pr-4 text-left font-medium">Category</th>
                    <th className="pb-2 pr-4 text-left font-medium">Type</th>
                    <th className="pb-2 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4 font-medium">
                        {entry.contractor
                          ? [entry.contractor.first_name, entry.contractor.last_name].filter(Boolean).join(' ') || '—'
                          : '—'}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {entry.jobs?.title ?? <span className="italic">Standalone</span>}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(entry.started_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                        {new Date(entry.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                        {entry.ended_at
                          ? new Date(entry.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : <span className="text-amber-600">Running</span>}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{entry.category ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={entry.is_break ? 'secondary' : 'outline'} className="text-xs">
                          {entry.is_break ? 'Break' : 'Work'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {entry.duration_minutes != null
                          ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td colSpan={7} className="py-2 pr-4 text-xs uppercase tracking-wide text-muted-foreground">Total work</td>
                    <td className="py-2 text-right tabular-nums">{Math.floor(workMinutes / 60)}h {workMinutes % 60}m</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showLogTime && logTimeContractorId && (
        <LogTimeDialog
          open={showLogTime}
          onOpenChange={setShowLogTime}
          projectSlug={slug}
          contractorPersonId={logTimeContractorId}
          mode="admin"
          onCreated={() => void loadEntries()}
        />
      )}
    </div>
  );
}
