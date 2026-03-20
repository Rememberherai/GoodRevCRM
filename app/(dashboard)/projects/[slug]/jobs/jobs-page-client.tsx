'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BriefcaseBusiness, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ContractorOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface JobListItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  desired_start: string | null;
  deadline: string | null;
  is_out_of_scope: boolean;
  contractor?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  time_entries?: Array<{
    duration_minutes: number | null;
  }>;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  contractor_id: '',
  priority: 'medium',
  desired_start: '',
  deadline: '',
  service_category: '',
  service_address: '',
  notes: '',
};

export function JobsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsResponse, contractorResponse] = await Promise.all([
        fetch(`/api/projects/${slug}/jobs`),
        fetch(`/api/projects/${slug}/people?is_contractor=true&limit=100`),
      ]);

      const jobsData = await jobsResponse.json() as { jobs?: JobListItem[]; error?: string };
      const contractorData = await contractorResponse.json() as { people?: ContractorOption[]; error?: string };

      if (!jobsResponse.ok) throw new Error(jobsData.error ?? 'Failed to load jobs');
      if (!contractorResponse.ok) throw new Error(contractorData.error ?? 'Failed to load contractors');

      setJobs(jobsData.jobs ?? []);
      setContractors(contractorData.people ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleJobs = useMemo(() => {
    if (statusFilter === 'all') return jobs;
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  const submitJob = async () => {
    if (!form.title.trim()) {
      toast.error('Job title is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        contractor_id: form.contractor_id || null,
        priority: form.priority,
        desired_start: form.desired_start ? new Date(form.desired_start).toISOString() : null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        service_category: form.service_category || null,
        service_address: form.service_address || null,
        notes: form.notes || null,
      };

      let response = await fetch(`/api/projects/${slug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = await response.json() as { error?: string; requires_override?: boolean };

      if (response.status === 409 && data.requires_override) {
        const confirmed = window.confirm(`${data.error}\n\nSend it anyway as an out-of-scope assignment?`);
        if (confirmed) {
          response = await fetch(`/api/projects/${slug}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, allow_out_of_scope: true }),
          });
          data = await response.json() as { error?: string };
        }
      }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create job');
      }

      toast.success('Job created');
      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BriefcaseBusiness className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Jobs</h2>
          <p className="text-sm text-muted-foreground">Assign work, monitor acceptance, and track completion.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Job</CardTitle>
          <CardDescription>Assign work directly to a contractor or leave it open for qualified contractors.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="job-title">Title</Label>
            <Input id="job-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-contractor">Contractor</Label>
            <select
              id="job-contractor"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.contractor_id}
              onChange={(event) => setForm((current) => ({ ...current, contractor_id: event.target.value }))}
            >
              <option value="">Unassigned / open job</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {[contractor.first_name, contractor.last_name].filter(Boolean).join(' ') || contractor.email || 'Unnamed contractor'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-priority">Priority</Label>
            <select
              id="job-priority"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-service-category">Service Category</Label>
            <Input id="job-service-category" value={form.service_category} onChange={(event) => setForm((current) => ({ ...current, service_category: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-desired-start">Desired Start</Label>
            <Input id="job-desired-start" type="datetime-local" value={form.desired_start} onChange={(event) => setForm((current) => ({ ...current, desired_start: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-deadline">Deadline</Label>
            <Input id="job-deadline" type="datetime-local" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="job-address">Service Address</Label>
            <Input id="job-address" value={form.service_address} onChange={(event) => setForm((current) => ({ ...current, service_address: event.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="job-description">Description</Label>
            <Textarea id="job-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="job-notes">Notes</Label>
            <Textarea id="job-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => void submitJob()} disabled={submitting}>
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Job Queue</CardTitle>
            <CardDescription>Review assigned, accepted, pulled, and completed work.</CardDescription>
          </div>
          <select
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm md:w-52"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In progress</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="pulled">Pulled</option>
          </select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              No jobs match this filter yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleJobs.map((job) => {
                const totalMinutes = (job.time_entries ?? []).reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0);
                return (
                  <Link
                    key={job.id}
                    href={`/projects/${slug}/jobs/${job.id}`}
                    className="block rounded-xl border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{job.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {job.contractor
                            ? [job.contractor.first_name, job.contractor.last_name].filter(Boolean).join(' ')
                            : 'Unassigned job'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{job.status.replace(/_/g, ' ')}</Badge>
                        <Badge variant="outline">{job.priority}</Badge>
                        {job.is_out_of_scope && <Badge variant="destructive">Out of scope</Badge>}
                        {totalMinutes > 0 && <Badge variant="outline">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</Badge>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
