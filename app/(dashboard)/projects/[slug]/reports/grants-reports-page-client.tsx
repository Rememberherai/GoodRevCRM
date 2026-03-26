'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, DollarSign, TrendingUp, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PipelineData {
  status: string;
  count: number;
  total_requested: number;
  total_awarded: number;
}

interface DeadlineItem {
  grant_id: string;
  grant_name: string;
  type: string;
  date: string;
}

interface ComplianceItem {
  grant_id: string;
  grant_name: string;
  status: string;
  overdue_reports: number;
  upcoming_reports: number;
  total_reports: number;
  completed_reports: number;
}

interface GrantsReportData {
  pipeline: PipelineData[];
  deadlines: DeadlineItem[];
  compliance: ComplianceItem[];
  totals: {
    totalGrants: number;
    totalRequested: number;
    totalAwarded: number;
    winRate: number | null;
  };
}

const STATUS_LABELS: Record<string, string> = {
  researching: 'Researching',
  preparing: 'Preparing',
  submitted: 'Submitted',
  under_review: 'Under Review',
  awarded: 'Awarded',
  active: 'Active',
  closed: 'Closed',
  declined: 'Declined',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

interface GrantsReportsPageClientProps {
  projectSlug: string;
}

export function GrantsReportsPageClient({ projectSlug }: GrantsReportsPageClientProps) {
  const [data, setData] = useState<GrantsReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Reuse the dashboard API which has all the data we need
      const res = await fetch(`/api/projects/${projectSlug}/grants/dashboard`);
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const dashboard = await res.json();

      // Also fetch compliance data
      let compliance: ComplianceItem[] = [];
      try {
        const compRes = await fetch(`/api/projects/${projectSlug}/community/reports/grant-compliance`);
        if (compRes.ok) {
          const compData = await compRes.json();
          compliance = compData.grants ?? [];
        }
      } catch {
        // compliance endpoint may not exist yet
      }

      const pipeline: PipelineData[] = Object.entries(dashboard.statusCounts as Record<string, { count: number; requested: number; awarded: number }>).map(
        ([status, vals]) => ({
          status,
          count: vals.count,
          total_requested: vals.requested,
          total_awarded: vals.awarded,
        })
      );

      setData({
        pipeline,
        deadlines: dashboard.deadlines ?? [],
        compliance,
        totals: {
          totalGrants: dashboard.summary.totalGrants,
          totalRequested: dashboard.summary.totalRequested,
          totalAwarded: dashboard.summary.totalAwarded,
          winRate: dashboard.summary.winRate,
        },
      });
    } catch (err) {
      console.error('Failed to load grants report data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Grants Reports</h2>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { pipeline, deadlines, compliance, totals } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Grants Reports</h2>
        <p className="text-muted-foreground">Pipeline analytics, deadlines, and compliance tracking</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Grants</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalGrants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requested</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalRequested)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Awarded</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalAwarded)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.winRate !== null ? `${totals.winRate}%` : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline Breakdown</TabsTrigger>
          <TabsTrigger value="deadlines">All Deadlines</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grants by Status</CardTitle>
              <CardDescription>Count and dollar amounts per pipeline stage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-right py-2 font-medium">Count</th>
                      <th className="text-right py-2 font-medium">Requested</th>
                      <th className="text-right py-2 font-medium">Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline
                      .sort((a, b) => {
                        const order = ['researching', 'preparing', 'submitted', 'under_review', 'awarded', 'active', 'closed', 'declined'];
                        return order.indexOf(a.status) - order.indexOf(b.status);
                      })
                      .map((row) => (
                        <tr key={row.status} className="border-b last:border-0">
                          <td className="py-2">
                            <Badge variant="outline">{STATUS_LABELS[row.status] ?? row.status}</Badge>
                          </td>
                          <td className="text-right py-2">{row.count}</td>
                          <td className="text-right py-2">{row.total_requested > 0 ? formatCurrency(row.total_requested) : '—'}</td>
                          <td className="text-right py-2">{row.total_awarded > 0 ? formatCurrency(row.total_awarded) : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
              <CardDescription>All grant deadlines in the next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {deadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No upcoming deadlines</p>
              ) : (
                <div className="space-y-2">
                  {deadlines.map((d, i) => {
                    const daysUntil = Math.ceil((new Date(d.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysUntil <= 7;
                    return (
                      <div key={`${d.grant_id}-${d.type}-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Clock className={`h-4 w-4 shrink-0 ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`} />
                          <div>
                            <p className="text-sm font-medium">{d.grant_name}</p>
                            <p className="text-xs text-muted-foreground">{d.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(d.date).toLocaleDateString()}</span>
                          <Badge variant={isUrgent ? 'destructive' : 'secondary'}>
                            {daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grant Compliance</CardTitle>
              <CardDescription>Report submission status across active grants</CardDescription>
            </CardHeader>
            <CardContent>
              {compliance.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No compliance data available. Create report schedules on your grants to track compliance.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Grant</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-right py-2 font-medium">Completed</th>
                        <th className="text-right py-2 font-medium">Upcoming</th>
                        <th className="text-right py-2 font-medium">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compliance.map((c) => (
                        <tr key={c.grant_id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{c.grant_name}</td>
                          <td className="py-2">
                            <Badge variant="outline">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                          </td>
                          <td className="text-right py-2">{c.completed_reports}</td>
                          <td className="text-right py-2">{c.upcoming_reports}</td>
                          <td className="text-right py-2">
                            {c.overdue_reports > 0 ? (
                              <Badge variant="destructive">{c.overdue_reports}</Badge>
                            ) : (
                              '0'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
