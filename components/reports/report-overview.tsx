'use client';

import * as React from 'react';
import {
  Target,
  DollarSign,
  Activity,
  TrendingUp,
  Users,
  LineChart,
  BarChart3,
  Clock,
  Globe,
  Lock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AnalyticsData } from '@/types/analytics';
import type { ReportDefinition } from '@/types/report';
import { reportTypeLabels } from '@/types/report';

interface ReportOverviewProps {
  projectSlug: string;
  data: AnalyticsData;
  onTabChange: (tab: string) => void;
}

const QUICK_REPORTS = [
  {
    key: 'pipeline',
    title: 'Pipeline Report',
    description: 'Current pipeline by stage with weighted values and opportunity distribution',
    icon: Target,
    color: 'emerald',
  },
  {
    key: 'revenue',
    title: 'Revenue Report',
    description: 'Revenue trends, closed-won analysis, and deal metrics over time',
    icon: DollarSign,
    color: 'green',
  },
  {
    key: 'activity',
    title: 'Activity Report',
    description: 'Team activity metrics, engagement tracking, and email performance',
    icon: Activity,
    color: 'blue',
  },
  {
    key: 'conversion',
    title: 'Conversion Report',
    description: 'Win/loss analysis, conversion rates, and RFP funnel metrics',
    icon: TrendingUp,
    color: 'orange',
  },
  {
    key: 'team',
    title: 'Team Performance',
    description: 'Individual leaderboard with opportunities, revenue, and activity rankings',
    icon: Users,
    color: 'purple',
  },
  {
    key: 'forecasting',
    title: 'Forecasting',
    description: 'Quarterly revenue projections from open pipeline with weighted estimates',
    icon: LineChart,
    color: 'cyan',
  },
] as const;

const COLOR_MAP: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', darkBg: 'dark:bg-emerald-900/30', darkText: 'dark:text-emerald-400' },
  green: { bg: 'bg-green-100', text: 'text-green-600', darkBg: 'dark:bg-green-900/30', darkText: 'dark:text-green-400' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-400' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-400' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', darkBg: 'dark:bg-cyan-900/30', darkText: 'dark:text-cyan-400' },
};

const REPORT_TYPE_COLORS: Record<string, string> = {
  pipeline: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  revenue: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  activity: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  conversion: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  team_performance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  forecasting: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  custom: 'bg-muted text-muted-foreground',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ReportOverview({ projectSlug, data, onTabChange }: ReportOverviewProps) {
  const [savedReports, setSavedReports] = React.useState<ReportDefinition[]>([]);
  const [reportsLoading, setReportsLoading] = React.useState(true);

  // Fetch saved reports
  React.useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/reports`);
        if (res.ok) {
          const json = await res.json();
          setSavedReports(json.data ?? json.reports ?? []);
        }
      } catch {
        // Silently fail - saved reports are optional
      } finally {
        setReportsLoading(false);
      }
    }
    loadReports();
  }, [projectSlug]);

  // Calculate summary stats for the cards
  const totalPipeline = data.pipeline.reduce((sum, s) => sum + Number(s.total_value), 0);
  const totalWeighted = data.pipeline.reduce((sum, s) => sum + Number(s.weighted_value), 0);
  const totalRevenue = data.revenue.reduce((sum, r) => sum + Number(r.closed_won_value), 0);
  const winRate = (() => {
    const totalWon = data.conversion.reduce((sum, c) => sum + Number(c.won_count), 0);
    const totalClosed = data.conversion.reduce((sum, c) => sum + Number(c.won_count) + Number(c.lost_count), 0);
    return totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;
  })();

  return (
    <div className="space-y-8">
      {/* Summary KPI Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Pipeline</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalPipeline)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/20">
              <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Weighted Value</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalWeighted)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500/20">
              <div className="h-full bg-green-500" style={{ width: totalPipeline > 0 ? `${(totalWeighted / totalPipeline) * 100}%` : '0%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Revenue (Period)</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500/20">
              <div className="h-full bg-blue-500" style={{ width: '100%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {winRate}%
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500/20">
              <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${winRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Reports */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Quick Reports</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Jump into a pre-built report view with your current filters applied
        </p>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {QUICK_REPORTS.map((report) => {
            const colors = (COLOR_MAP[report.color] ?? COLOR_MAP.blue)!;
            return (
              <Card
                key={report.key}
                className="cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md group"
                onClick={() => onTabChange(report.key)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.darkBg} transition-transform duration-200 group-hover:scale-110`}>
                      <report.icon className={`h-5 w-5 ${colors.text} ${colors.darkText}`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {report.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Saved Reports */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Saved Reports</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Your saved report configurations
        </p>

        {reportsLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading saved reports...
          </div>
        ) : savedReports.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No saved reports yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Open any report view and save it to create reusable configurations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium">Report</th>
                  <th className="text-left py-3 px-4 font-medium">Type</th>
                  <th className="text-left py-3 px-4 font-medium">Schedule</th>
                  <th className="text-left py-3 px-4 font-medium">Visibility</th>
                  <th className="text-right py-3 px-4 font-medium">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {savedReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{report.name}</p>
                        {report.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {report.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="secondary"
                        className={REPORT_TYPE_COLORS[report.report_type] ?? REPORT_TYPE_COLORS.custom}
                      >
                        {reportTypeLabels[report.report_type]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {report.schedule ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {report.schedule.charAt(0).toUpperCase() + report.schedule.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Manual</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {report.is_public ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          Public
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Private
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                      {report.last_run_at
                        ? new Date(report.last_run_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
