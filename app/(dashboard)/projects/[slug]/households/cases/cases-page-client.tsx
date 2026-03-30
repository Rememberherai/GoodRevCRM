'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CaseRecord {
  id: string;
  status: string;
  priority: string;
  opened_at: string;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  household?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string | null; email: string } | null;
}

export function CasesPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [overdue, setOverdue] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams({ limit: '100', offset: '0' });
      if (status !== 'all') searchParams.set('status', status);
      if (priority !== 'all') searchParams.set('priority', priority);
      if (overdue) searchParams.set('overdue', 'true');

      const response = await fetch(`/api/projects/${slug}/households/cases?${searchParams.toString()}`);
      const data = await response.json() as { cases?: CaseRecord[] };
      if (response.ok) {
        setCases(data.cases ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [overdue, priority, slug, status]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Cases</h2>
            <p className="text-sm text-muted-foreground">
              Household case queue with follow-up and priority tracking.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/projects/${slug}/households`}>Back to Households</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Queue</CardTitle>
          <CardDescription>
            Cases stay under Households so the primary navigation does not expand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={overdue ? 'default' : 'outline'} onClick={() => setOverdue((current) => !current)}>
              {overdue ? 'Showing Overdue' : 'Overdue Follow-Up Only'}
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading cases…</div>
          ) : cases.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No cases match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((record) => (
                record.household?.id ? (
                  <Link
                    key={record.id}
                    href={`/projects/${slug}/households/${record.household.id}?tab=case-plan`}
                    className="block rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-medium">{record.household.name ?? 'Unknown household'}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.assignee?.full_name ?? 'Unassigned'} • {record.status} • {record.priority}
                        </div>
                      </div>
                      <div className="grid gap-1 text-right text-xs text-muted-foreground">
                        <div>Opened {new Date(record.opened_at).toLocaleDateString()}</div>
                        <div>
                          {record.next_follow_up_at
                            ? `Follow-up ${new Date(record.next_follow_up_at).toLocaleString()}`
                            : 'No follow-up scheduled'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div
                    key={record.id}
                    className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                  >
                    Case {record.id} is missing its linked household record.
                  </div>
                )
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
