'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, DollarSign, TrendingUp, Clock, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DashboardData {
  summary: {
    totalGrants: number;
    totalRequested: number;
    totalAwarded: number;
    winRate: number | null;
    discoveredCount: number;
  };
  statusCounts: Record<string, { count: number; requested: number; awarded: number }>;
  deadlines: { grant_id: string; grant_name: string; type: string; date: string }[];
  recentGrants: { id: string; name: string; status: string; updated_at: string }[];
}

const STATUS_ORDER = ['researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined', 'not_a_fit'];
const STATUS_COLORS: Record<string, string> = {
  researching: 'bg-slate-500',
  preparing: 'bg-blue-500',
  submitted: 'bg-purple-500',
  under_review: 'bg-amber-500',
  awarded: 'bg-green-500',
  active: 'bg-emerald-600',
  closed: 'bg-gray-500',
  declined: 'bg-red-500',
  not_a_fit: 'bg-orange-500',
};
const STATUS_LABELS: Record<string, string> = {
  researching: 'Researching',
  preparing: 'Preparing',
  submitted: 'Submitted',
  under_review: 'Under Review',
  awarded: 'Awarded',
  active: 'Active',
  closed: 'Closed',
  declined: 'Declined',
  not_a_fit: 'Not a Fit',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

interface GrantsDashboardClientProps {
  projectSlug: string;
}

export function GrantsDashboardClient({ projectSlug }: GrantsDashboardClientProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectSlug}/grants/dashboard`)
      .then(r => { if (!r.ok) throw new Error('Failed to load dashboard'); return r.json(); })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectSlug]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Grants Dashboard</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><div className="h-8 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, statusCounts, deadlines, recentGrants } = data;

  // Calculate max for pipeline bar chart
  const pipelineStatuses = STATUS_ORDER.filter(s => s !== 'declined' && s !== 'closed' && s !== 'not_a_fit');
  const maxCount = Math.max(...pipelineStatuses.map(s => statusCounts[s]?.count ?? 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Grants Dashboard</h2>
        <p className="text-muted-foreground">Overview of your grant portfolio</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Grants</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalGrants}</div>
            <CardDescription>In pipeline</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requested</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRequested)}</div>
            <CardDescription>Across all grants</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Awarded</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalAwarded)}</div>
            <CardDescription>Confirmed funding</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.winRate !== null ? `${summary.winRate}%` : '—'}</div>
            <CardDescription>Of decided grants</CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Discovered Grants Banner */}
      {summary.discoveredCount > 0 && (
        <Link href={`/projects/${projectSlug}/grants?tab=discovered`}>
          <Card className="border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Search className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-medium">
                {summary.discoveredCount} discovered grant{summary.discoveredCount !== 1 ? 's' : ''} waiting for review
              </span>
              <span className="text-xs text-muted-foreground ml-auto">View &rarr;</span>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grant Pipeline</CardTitle>
            <CardDescription>Grants by stage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipelineStatuses.map(status => {
              const statusData = statusCounts[status];
              if (!statusData) return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{STATUS_LABELS[status]}</span>
                  <div className="flex-1 h-6 bg-muted rounded" />
                  <span className="text-xs text-muted-foreground w-8 text-right">0</span>
                </div>
              );
              const width = Math.max((statusData.count / maxCount) * 100, 4);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{STATUS_LABELS[status]}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className={`h-full ${STATUS_COLORS[status]} rounded flex items-center px-2 transition-all`}
                      style={{ width: `${width}%` }}
                    >
                      {statusData.requested > 0 && (
                        <span className="text-[10px] text-white font-medium truncate">
                          {formatCurrency(statusData.requested)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{statusData.count}</span>
                </div>
              );
            })}
            {/* Declined / Not a Fit summary */}
            {(statusCounts['declined'] || statusCounts['not_a_fit']) && (
              <div className="flex items-center gap-3 pt-2 border-t flex-wrap">
                {statusCounts['declined'] && (
                  <>
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Declined</span>
                    <span className="text-xs text-red-500">{statusCounts['declined'].count} grant{statusCounts['declined'].count !== 1 ? 's' : ''}</span>
                  </>
                )}
                {statusCounts['not_a_fit'] && (
                  <>
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Not a Fit</span>
                    <span className="text-xs text-orange-500">{statusCounts['not_a_fit'].count} grant{statusCounts['not_a_fit'].count !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
            <CardDescription>Next 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {deadlines.slice(0, 8).map((d, i) => {
                  const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? new Date(d.date + 'T00:00:00') : new Date(d.date);
                  const daysUntil = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysUntil <= 7;
                  return (
                    <Link
                      key={`${d.grant_id}-${d.type}-${i}`}
                      href={`/projects/${projectSlug}/grants/${d.grant_id}`}
                      className="flex items-center gap-3 hover:bg-accent rounded px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <Clock className={`h-4 w-4 shrink-0 ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.grant_name}</p>
                        <p className="text-xs text-muted-foreground">{d.type}</p>
                      </div>
                      <Badge variant={isUrgent ? 'destructive' : 'secondary'} className="shrink-0">
                        {daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recently Updated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently Updated</CardTitle>
        </CardHeader>
        <CardContent>
          {recentGrants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grants yet. <Link href={`/projects/${projectSlug}/grants`} className="text-primary hover:underline">Create your first grant</Link></p>
          ) : (
            <div className="space-y-2">
              {recentGrants.map(g => (
                <Link
                  key={g.id}
                  href={`/projects/${projectSlug}/grants/${g.id}`}
                  className="flex items-center justify-between hover:bg-accent rounded px-2 py-2 -mx-2 transition-colors"
                >
                  <span className="text-sm font-medium truncate">{g.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{STATUS_LABELS[g.status] ?? g.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(g.updated_at).toLocaleDateString()}
                    </span>
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
