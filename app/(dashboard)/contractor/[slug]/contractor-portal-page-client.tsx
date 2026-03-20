'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeTracker } from '@/components/community/jobs/time-tracker';

interface JobRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  desired_start: string | null;
  notes: string | null;
  contractor?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function ContractorPortalPageClient({
  projectSlug,
  contractorPersonId,
}: {
  projectSlug: string;
  contractorPersonId: string | null;
}) {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeUnassigned: 'true' });
      if (contractorPersonId) params.set('contractorId', contractorPersonId);

      const response = await fetch(`/api/projects/${projectSlug}/jobs?${params}`);
      const data = await response.json() as { jobs?: JobRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load jobs');
      setJobs(data.jobs ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [projectSlug, contractorPersonId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const assignedJobs = useMemo(
    () => jobs.filter((job) => Boolean(job.contractor)),
    [jobs]
  );
  const availableJobs = useMemo(
    () => jobs.filter((job) => !job.contractor),
    [jobs]
  );

  const takeAction = async (jobId: string, action: 'accept' | 'decline') => {
    try {
      let body: Record<string, unknown> = {};
      if (action === 'decline') {
        const reason = window.prompt('Why are you declining this job?');
        if (reason === null) return;
        body = { reason };
      }

      const response = await fetch(`/api/projects/${projectSlug}/jobs/${jobId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Failed to ${action} job`);
      const pastTense: Record<string, string> = { accept: 'accepted', decline: 'declined' };
      toast.success(`Job ${pastTense[action] ?? action}`);
      await loadJobs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} job`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Jobs</h2>
        <p className="text-sm text-muted-foreground">Track accepted work, start the clock, and pick up authorized open jobs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned to Me</CardTitle>
          <CardDescription>Accepted and active work assigned to your contractor profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : assignedJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No assigned jobs yet.
            </div>
          ) : assignedJobs.map((job) => (
            <div key={job.id} className="space-y-4 rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="font-semibold">{job.title}</div>
                  <div className="text-sm text-muted-foreground">{job.description || 'No description provided.'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{job.status.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{job.priority}</Badge>
                  {job.deadline && <Badge variant="outline">Due {new Date(job.deadline).toLocaleDateString()}</Badge>}
                </div>
              </div>

              {job.status === 'assigned' && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void takeAction(job.id, 'accept')}>Accept</Button>
                  <Button variant="secondary" onClick={() => void takeAction(job.id, 'decline')}>Decline</Button>
                </div>
              )}

              {job.status !== 'completed' && job.status !== 'declined' && job.status !== 'pulled' && (
                <TimeTracker slug={projectSlug} jobId={job.id} initialStatus={job.status} onRefresh={loadJobs} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Jobs</CardTitle>
          <CardDescription>Unassigned jobs that match your current scope and certifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : availableJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No open jobs are available right now.
            </div>
          ) : availableJobs.map((job) => (
            <div key={job.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="font-semibold">{job.title}</div>
                  <div className="text-sm text-muted-foreground">{job.description || 'No description provided.'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{job.status.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline">{job.priority}</Badge>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={() => void takeAction(job.id, 'accept')}>Take Job</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
