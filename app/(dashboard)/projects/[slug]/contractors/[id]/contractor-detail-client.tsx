'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, HardHat, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NewScopeDialog } from '@/components/community/contractors/new-scope-dialog';
import { LogTimeDialog } from '@/components/community/contractors/log-time-dialog';

interface ContractorPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_contractor: boolean | null;
}

interface ContractorScope {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  compensation_terms: string | null;
  service_categories: string[] | null;
  certifications: string[] | null;
  document_url: string | null;
}

interface JobRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
}

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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function ContractorDetailClient({ contractorId }: { contractorId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [person, setPerson] = useState<ContractorPerson | null>(null);
  const [scopes, setScopes] = useState<ContractorScope[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewScope, setShowNewScope] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [togglingScope, setTogglingScope] = useState<string | null>(null);

  const [timeEntries, setTimeEntries] = useState<TimeEntryRow[]>([]);
  const [teLoading, setTeLoading] = useState(true);
  const [teFrom, setTeFrom] = useState(() => startOfMonth(new Date()));
  const [teTo, setTeTo] = useState(() => endOfMonth(new Date()));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [personResponse, scopesResponse, jobsResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/people/${contractorId}`),
        fetch(`/api/projects/${slug}/contractor-scopes?contractorId=${contractorId}`),
        fetch(`/api/projects/${slug}/jobs?contractorId=${contractorId}`),
      ]);

      const personData = await personResponse.json() as { person?: ContractorPerson; error?: string };
      const scopesData = await scopesResponse.json() as { scopes?: ContractorScope[]; error?: string };
      const jobsData = await jobsResponse.json() as { jobs?: JobRecord[]; error?: string };

      if (!personResponse.ok || !personData.person) throw new Error(personData.error ?? 'Failed to load contractor');
      if (!scopesResponse.ok) throw new Error(scopesData.error ?? 'Failed to load scopes');
      if (!jobsResponse.ok) throw new Error(jobsData.error ?? 'Failed to load jobs');

      setPerson(personData.person);
      setScopes(scopesData.scopes ?? []);
      setJobs(jobsData.jobs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load contractor');
    } finally {
      setLoading(false);
    }
  }, [contractorId, slug]);

  const loadTimeEntries = useCallback(async () => {
    setTeLoading(true);
    try {
      const params = new URLSearchParams({
        contractor_id: contractorId,
        from: teFrom,
        to: teTo,
        limit: '200',
      });
      const response = await fetch(`/api/projects/${slug}/time-entries?${params}`);
      const data = await response.json() as { entries?: TimeEntryRow[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load time entries');
      setTimeEntries(data.entries ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setTeLoading(false);
    }
  }, [contractorId, slug, teFrom, teTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadTimeEntries();
  }, [loadTimeEntries]);

  const workMinutes = useMemo(
    () => timeEntries.filter((e) => !e.is_break).reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0),
    [timeEntries]
  );
  const breakMinutes = useMemo(
    () => timeEntries.filter((e) => e.is_break).reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0),
    [timeEntries]
  );

  const toggleScopeStatus = async (scopeId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'expired' : 'active';
    setTogglingScope(scopeId);
    try {
      const response = await fetch(`/api/projects/${slug}/contractor-scopes/${scopeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to update scope');
      setScopes((prev) => prev.map((s) => s.id === scopeId ? { ...s, status: nextStatus } : s));
      toast.success(`Scope ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update scope');
    } finally {
      setTogglingScope(null);
    }
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  }

  if (error || !person) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/projects/${slug}/workforce`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workforce
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? 'Contractor not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="px-0">
        <Link href={`/projects/${slug}/workforce`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Workforce
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {[person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || 'Unnamed contractor'}
              </h2>
              <div className="text-sm text-muted-foreground">{person.email || person.phone || 'No contact details'}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contractor/${slug}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Contractor Portal
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{scopes[0]?.status?.replace(/_/g, ' ') ?? 'no scope'}</Badge>
          <Badge variant="outline">{jobs.filter((job) => !['completed', 'declined', 'pulled', 'cancelled'].includes(job.status)).length} active jobs</Badge>
          <Badge variant="outline">{Math.floor(workMinutes / 60)}h {workMinutes % 60}m work</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scope of Work</CardTitle>
                <CardDescription>Current scope records and signed document links.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowNewScope(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Scope
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {scopes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No scopes on file yet.
              </div>
            ) : scopes.map((scope) => (
              <div key={scope.id} className="rounded-lg border p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{scope.title}</div>
                  <button
                    type="button"
                    disabled={togglingScope === scope.id}
                    onClick={() => void toggleScopeStatus(scope.id, scope.status)}
                    title={scope.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                  >
                    <Badge variant={scope.status === 'active' ? 'default' : 'secondary'} className="cursor-pointer">
                      {togglingScope === scope.id ? '...' : scope.status.replace(/_/g, ' ')}
                    </Badge>
                  </button>
                </div>
                <div className="mt-2 text-muted-foreground">{scope.description || 'No description provided.'}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(scope.service_categories ?? []).map((category) => (
                    <Badge key={category} variant="outline">{category}</Badge>
                  ))}
                  {(scope.certifications ?? []).map((certification) => (
                    <Badge key={certification} variant="outline">{certification}</Badge>
                  ))}
                </div>
                {scope.document_url && (
                  <div className="mt-3">
                    <a href={scope.document_url} className="text-sm font-medium text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                      Open scope document
                    </a>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>Assigned work and total logged hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No jobs assigned yet.
              </div>
            ) : jobs.map((job) => (
              <Link
                key={job.id}
                href={`/projects/${slug}/jobs/${job.id}`}
                className="block rounded-lg border p-4 text-sm transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{job.title}</div>
                  <Badge variant="secondary">{job.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{job.priority}</Badge>
                  {job.deadline && <Badge variant="outline">{new Date(job.deadline).toLocaleDateString()}</Badge>}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Time Entries card — full width below the grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Time Entries</CardTitle>
              <CardDescription>All logged hours including standalone entries not tied to a job.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Label htmlFor="te-from" className="sr-only">From</Label>
                <Input
                  id="te-from"
                  type="date"
                  value={teFrom}
                  onChange={(e) => setTeFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <span className="text-muted-foreground">—</span>
                <Label htmlFor="te-to" className="sr-only">To</Label>
                <Input
                  id="te-to"
                  type="date"
                  value={teTo}
                  onChange={(e) => setTeTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowLogTime(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {teLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          ) : (
            <div className="space-y-3">
              {timeEntries.length > 0 && (
                <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Work: </span>
                    <span className="font-semibold">{Math.floor(workMinutes / 60)}h {workMinutes % 60}m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Break: </span>
                    <span className="font-semibold">{Math.floor(breakMinutes / 60)}h {breakMinutes % 60}m</span>
                  </div>
                </div>
              )}
              {timeEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No time entries for this period.
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
                        <th className="pb-2 text-right font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {timeEntries.map((entry) => (
                        <tr key={entry.id} className="py-2">
                          <td className="py-2 pr-4 text-muted-foreground">
                            {new Date(entry.started_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4">
                            {entry.jobs?.title ?? <span className="text-muted-foreground">—</span>}
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
                              : 'Running'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <NewScopeDialog
        open={showNewScope}
        onOpenChange={setShowNewScope}
        projectSlug={slug}
        contractorId={contractorId}
        onCreated={() => void loadData()}
      />

      <LogTimeDialog
        open={showLogTime}
        onOpenChange={setShowLogTime}
        projectSlug={slug}
        contractorPersonId={contractorId}
        mode="admin"
        onCreated={() => void loadTimeEntries()}
      />
    </div>
  );
}
