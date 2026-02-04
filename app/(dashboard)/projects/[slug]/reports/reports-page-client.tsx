'use client';

import * as React from 'react';
import { subDays } from 'date-fns';
import {
  BarChart3,
  Target,
  DollarSign,
  Activity,
  TrendingUp,
  Users,
  LineChart,
  Loader2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import { UserFilter } from '@/components/dashboard/user-filter';
import { ReportOverview } from '@/components/reports/report-overview';
import { PipelineReportView } from '@/components/reports/pipeline-report-view';
import { RevenueReportView } from '@/components/reports/revenue-report-view';
import { ActivityReportView } from '@/components/reports/activity-report-view';
import { ConversionReportView } from '@/components/reports/conversion-report-view';
import { TeamReportView } from '@/components/reports/team-report-view';
import { ForecastingView } from '@/components/reports/forecasting-view';
import type { AnalyticsData, DateRange, TeamMember } from '@/types/analytics';

interface ReportsPageClientProps {
  projectSlug: string;
  currentUserId: string;
}

const DEFAULT_RANGE: DateRange = {
  from: subDays(new Date(), 30),
  to: new Date(),
};

const TAB_CONFIG = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'pipeline', label: 'Pipeline', icon: Target },
  { value: 'revenue', label: 'Revenue', icon: DollarSign },
  { value: 'activity', label: 'Activity', icon: Activity },
  { value: 'conversion', label: 'Conversion', icon: TrendingUp },
  { value: 'team', label: 'Team', icon: Users },
  { value: 'forecasting', label: 'Forecasting', icon: LineChart },
] as const;

export function ReportsPageClient({ projectSlug, currentUserId }: ReportsPageClientProps) {
  const [activeTab, setActiveTab] = React.useState('overview');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(DEFAULT_RANGE);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch analytics data when filters change
  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (dateRange) {
          params.set('start_date', dateRange.from.toISOString());
          params.set('end_date', dateRange.to.toISOString());
        }
        if (userId) {
          params.set('user_id', userId);
        }

        const res = await fetch(
          `/api/projects/${projectSlug}/analytics?${params.toString()}`
        );

        if (!res.ok) {
          throw new Error(`Failed to load analytics (${res.status})`);
        }

        const json = await res.json();

        if (!cancelled) {
          setData({
            activityTiles: json.activityTiles,
            opportunityFunnel: json.opportunityFunnel,
            rfpFunnel: json.rfpFunnel,
            pipeline: json.pipeline,
            conversion: json.conversion,
            revenue: json.revenue,
            email: json.email,
            aiUsage: json.aiUsage,
            enrichment: json.enrichment,
            teamMembers: json.teamMembers,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [projectSlug, dateRange, userId]);

  const teamMembers: TeamMember[] = data?.teamMembers ?? [];

  return (
    <div className="space-y-6">
      {/* Premium Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Reporting</h2>
            <p className="text-sm text-muted-foreground">
              Analytics, insights, and forecasting across your CRM
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-10 -mx-6 bg-background/80 px-6 py-3 backdrop-blur-sm border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto flex-wrap">
              {TAB_CONFIG.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <UserFilter
              value={userId}
              onChange={setUserId}
              teamMembers={teamMembers}
              currentUserId={currentUserId}
            />
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading report data...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tab Content */}
      {data && !loading && (
        <div>
          {activeTab === 'overview' && (
            <ReportOverview
              projectSlug={projectSlug}
              data={data}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === 'pipeline' && (
            <PipelineReportView data={data} />
          )}
          {activeTab === 'revenue' && (
            <RevenueReportView data={data} />
          )}
          {activeTab === 'activity' && (
            <ActivityReportView
              data={data}
              projectSlug={projectSlug}
              dateRange={dateRange}
              userId={userId}
            />
          )}
          {activeTab === 'conversion' && (
            <ConversionReportView data={data} />
          )}
          {activeTab === 'team' && (
            <TeamReportView
              data={data}
              projectSlug={projectSlug}
              dateRange={dateRange}
              userId={userId}
            />
          )}
          {activeTab === 'forecasting' && (
            <ForecastingView
              projectSlug={projectSlug}
              userId={userId}
            />
          )}
        </div>
      )}
    </div>
  );
}
