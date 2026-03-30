'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportIncidentDialog } from '@/components/community/incidents/report-incident-dialog';

interface IncidentRecord {
  id: string;
  summary: string;
  status: string;
  severity: string;
  category: string;
  occurred_at: string;
  follow_up_due_at: string | null;
  assignee?: { full_name: string | null } | null;
}

export function IncidentsPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const statusParam = searchParams.get('status');
  const [status, setStatus] = useState(
    statusParam === 'open' || statusParam === 'under_review' || statusParam === 'resolved' || statusParam === 'closed'
      ? statusParam
      : 'all'
  );
  const [severity, setSeverity] = useState('all');
  const unassignedParam = searchParams.get('unassigned');
  const [unassignedOnly, setUnassignedOnly] = useState(unassignedParam === 'true');
  const [showReportDialog, setShowReportDialog] = useState(false);

  useEffect(() => {
    setStatus(
      statusParam === 'open' || statusParam === 'under_review' || statusParam === 'resolved' || statusParam === 'closed'
        ? statusParam
        : 'all'
    );
  }, [statusParam]);

  useEffect(() => {
    setUnassignedOnly(unassignedParam === 'true');
  }, [unassignedParam]);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams({ limit: '100', offset: '0' });
      if (status !== 'all') searchParams.set('status', status);
      if (severity !== 'all') searchParams.set('severity', severity);
      if (unassignedOnly) searchParams.set('unassigned', 'true');
      const response = await fetch(`/api/projects/${slug}/incidents?${searchParams.toString()}`);
      const data = await response.json() as { incidents?: IncidentRecord[] };
      if (response.ok) {
        setIncidents(data.incidents ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [severity, slug, status, unassignedOnly]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Incidents</h2>
            <p className="text-sm text-muted-foreground">
              Safety, conflict, and operational incident queue.
            </p>
          </div>
        </div>
        <Button onClick={() => setShowReportDialog(true)}>Report Incident</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident Queue</CardTitle>
          <CardDescription>
            Review severity, assignment, and overdue follow-up from one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={unassignedOnly ? 'default' : 'outline'} onClick={() => setUnassignedOnly((current) => !current)}>
              {unassignedOnly ? 'Needs Assignment Only' : 'Show All Assignment States'}
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading incidents…</div>
          ) : incidents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No incidents match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/projects/${slug}/incidents/${incident.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">{incident.summary}</div>
                      <div className="text-sm text-muted-foreground">
                        {incident.status} • {incident.severity} • {incident.category}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{new Date(incident.occurred_at).toLocaleString()}</div>
                      <div>{incident.assignee?.full_name ?? 'Unassigned'}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ReportIncidentDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        projectSlug={slug}
        onCreated={() => void loadIncidents()}
      />
    </div>
  );
}
