'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { HardHat, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ContractorPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ContractorScope {
  id: string;
  contractor_id: string;
  status: string;
  document_url: string | null;
}

interface JobRecord {
  id: string;
  contractor_id: string | null;
  status: string;
  time_entries?: Array<{ duration_minutes: number | null }>;
}

export function ContractorsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [contractors, setContractors] = useState<ContractorPerson[]>([]);
  const [scopes, setScopes] = useState<ContractorScope[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [peopleResponse, scopesResponse, jobsResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/people?is_contractor=true&limit=100`),
        fetch(`/api/projects/${slug}/contractor-scopes`),
        fetch(`/api/projects/${slug}/jobs`),
      ]);

      const peopleData = await peopleResponse.json() as { people?: ContractorPerson[]; error?: string };
      const scopesData = await scopesResponse.json() as { scopes?: ContractorScope[]; error?: string };
      const jobsData = await jobsResponse.json() as { jobs?: JobRecord[]; error?: string };

      if (!peopleResponse.ok) throw new Error(peopleData.error ?? 'Failed to load contractors');
      if (!scopesResponse.ok) throw new Error(scopesData.error ?? 'Failed to load scopes');
      if (!jobsResponse.ok) throw new Error(jobsData.error ?? 'Failed to load jobs');

      setContractors(peopleData.people ?? []);
      setScopes(scopesData.scopes ?? []);
      setJobs(jobsData.jobs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load contractors');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const contractorRows = useMemo(() => (
    contractors.map((contractor) => {
      const contractorScopes = scopes.filter((scope) => scope.contractor_id === contractor.id);
      const contractorJobs = jobs.filter((job) => job.contractor_id === contractor.id);
      const totalMinutes = contractorJobs.reduce(
        (sum, job) => sum + (job.time_entries ?? []).reduce((inner, entry) => inner + (entry.duration_minutes ?? 0), 0),
        0
      );

      return {
        contractor,
        scopeStatus: contractorScopes[0]?.status ?? 'no_scope',
        hasDocuments: contractorScopes.some((scope) => Boolean(scope.document_url)),
        activeJobs: contractorJobs.filter((job) => ['assigned', 'accepted', 'in_progress', 'paused'].includes(job.status)).length,
        completedJobs: contractorJobs.filter((job) => job.status === 'completed').length,
        totalMinutes,
      };
    })
  ), [contractors, jobs, scopes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contractors</h2>
          <p className="text-sm text-muted-foreground">Monitor scope status, jobs, and logged hours.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Contractor Directory</CardTitle>
            <CardDescription>Use chat onboarding to create scopes, collect documents, and invite contractors.</CardDescription>
          </div>
          <Button variant="outline">
            <MessageSquare className="mr-2 h-4 w-4" />
            Open Chat to Onboard
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : contractorRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No contractors yet.
            </div>
          ) : (
            <div className="space-y-3">
              {contractorRows.map((row) => (
                <Link
                  key={row.contractor.id}
                  href={`/projects/${slug}/contractors/${row.contractor.id}`}
                  className="block rounded-xl border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {[row.contractor.first_name, row.contractor.last_name].filter(Boolean).join(' ') || row.contractor.email || 'Unnamed contractor'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {row.contractor.email || row.contractor.phone || 'No contact details'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{row.scopeStatus.replace(/_/g, ' ')}</Badge>
                      {row.hasDocuments && <Badge variant="outline">Docs on file</Badge>}
                      <Badge variant="outline">{row.activeJobs} active jobs</Badge>
                      <Badge variant="outline">{row.completedJobs} completed</Badge>
                      <Badge variant="outline">{Math.floor(row.totalMinutes / 60)}h {row.totalMinutes % 60}m</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
