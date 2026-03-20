'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeTracker } from '@/components/community/jobs/time-tracker';

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
  time_entries?: Array<{
    id: string;
    started_at: string;
    ended_at: string | null;
    is_break: boolean;
    duration_minutes: number | null;
    notes: string | null;
  }>;
}

export function JobDetailClient({ jobId }: { jobId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {(job.status === 'assigned' || job.status === 'pending') && (
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

      {job.status !== 'completed' && job.status !== 'pulled' && job.status !== 'declined' && (
        <TimeTracker slug={slug} jobId={job.id} initialStatus={job.status} onRefresh={loadJob} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Time Entry History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(job.time_entries ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No time entries yet.
            </div>
          ) : (
            (job.time_entries ?? []).map((entry) => (
              <div key={entry.id} className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium">
                    {entry.is_break ? 'Break' : 'Work'} started {new Date(entry.started_at).toLocaleString()}
                  </div>
                  <Badge variant="outline">
                    {entry.duration_minutes != null
                      ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m`
                      : 'Running'}
                  </Badge>
                </div>
                {entry.notes && <div className="mt-2 text-muted-foreground">{entry.notes}</div>}
              </div>
            ))
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
