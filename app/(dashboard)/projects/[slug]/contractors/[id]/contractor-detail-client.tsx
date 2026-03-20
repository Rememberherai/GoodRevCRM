'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, HardHat, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewScopeDialog } from '@/components/community/contractors/new-scope-dialog';

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
  time_entries?: Array<{ duration_minutes: number | null }>;
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalMinutes = useMemo(
    () => jobs.reduce((sum, job) => sum + (job.time_entries ?? []).reduce((inner, entry) => inner + (entry.duration_minutes ?? 0), 0), 0),
    [jobs]
  );

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted" />;
  }

  if (error || !person) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href={`/projects/${slug}/contractors`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contractors
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
        <Link href={`/projects/${slug}/contractors`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contractors
        </Link>
      </Button>

      <div className="space-y-3">
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
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{scopes[0]?.status?.replace(/_/g, ' ') ?? 'no scope'}</Badge>
          <Badge variant="outline">{jobs.filter((job) => job.status !== 'completed').length} active jobs</Badge>
          <Badge variant="outline">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m logged</Badge>
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
                  <Badge variant="secondary">{scope.status.replace(/_/g, ' ')}</Badge>
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

      <NewScopeDialog
        open={showNewScope}
        onOpenChange={setShowNewScope}
        projectSlug={slug}
        contractorId={contractorId}
        onCreated={() => void loadData()}
      />
    </div>
  );
}
