'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface GrantRecord {
  id: string;
  name: string;
  status: string;
  loi_due_at: string | null;
  application_due_at: string | null;
  report_due_at: string | null;
}

interface DeadlineEntry {
  grantId: string;
  grantName: string;
  type: string;
  date: string;
  daysUntil: number;
}

function computeDeadlines(grants: GrantRecord[]): DeadlineEntry[] {
  const now = new Date();
  const entries: DeadlineEntry[] = [];

  for (const grant of grants) {
    if (grant.status === 'declined' || grant.status === 'awarded') continue;

    const deadlines = [
      { type: 'LOI', date: grant.loi_due_at },
      { type: 'Application', date: grant.application_due_at },
      { type: 'Report', date: grant.report_due_at },
    ];

    for (const d of deadlines) {
      if (!d.date) continue;
      const deadlineDate = new Date(d.date);
      const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil > -30) {
        entries.push({
          grantId: grant.id,
          grantName: grant.name,
          type: d.type,
          date: d.date,
          daysUntil,
        });
      }
    }
  }

  entries.sort((a, b) => a.daysUntil - b.daysUntil);
  return entries;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function UpcomingDeadlines() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [deadlines, setDeadlines] = useState<DeadlineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeadlines = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/grants?limit=100`);
      const json = await res.json() as { grants?: GrantRecord[] };
      setDeadlines(computeDeadlines(json.grants ?? []));
    } catch {
      // Widget — fail silently
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchDeadlines(); }, [fetchDeadlines]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Upcoming Deadlines
        </CardTitle>
        <CardDescription>Grant deadlines in the next 90 days</CardDescription>
      </CardHeader>
      <CardContent>
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
        ) : (
          <div className="space-y-2">
            {deadlines.slice(0, 10).map((d, i) => (
              <button
                key={`${d.grantId}-${d.type}-${i}`}
                onClick={() => router.push(`/projects/${slug}/grants/${d.grantId}`)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-accent transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.grantName}</p>
                  <p className="text-muted-foreground">{d.type} deadline</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-muted-foreground">{formatDate(d.date)}</span>
                  {d.daysUntil < 0 ? (
                    <Badge variant="destructive">Overdue</Badge>
                  ) : d.daysUntil <= 7 ? (
                    <Badge variant="destructive">{d.daysUntil}d</Badge>
                  ) : d.daysUntil <= 30 ? (
                    <Badge variant="secondary">{d.daysUntil}d</Badge>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
