'use client';

import * as React from 'react';
import { subDays } from 'date-fns';
import { BarChart3, Loader2 } from 'lucide-react';

import type {
  AnalyticsData,
  DateRange,
  TeamMember,
} from '@/types/analytics';
import { DateRangePicker } from './date-range-picker';
import { UserFilter } from './user-filter';
import { ActivityTilesRow } from './activity-tiles';
import { OpportunityFunnelChart } from './opportunity-funnel-chart';
import { RfpFunnelChart } from './rfp-funnel-chart';
import { RevenueAreaChart } from './revenue-area-chart';
import { ConversionBarChart } from './conversion-bar-chart';
import { EmailStatsCard } from './email-stats-card';
import { AiUsageCard } from './ai-usage-card';
import { EnrichmentStatsCard } from './enrichment-stats-card';

interface AnalyticsDashboardProps {
  projectSlug: string;
  currentUserId: string;
}

const DEFAULT_RANGE: DateRange = {
  from: subDays(new Date(), 30),
  to: new Date(),
};

export function AnalyticsDashboard({ projectSlug, currentUserId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(DEFAULT_RANGE);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [openRouterKeyInfo, setOpenRouterKeyInfo] = React.useState<{
    usage: number;
    limit: number | null;
    is_free_tier: boolean;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch data when filters change
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
          setOpenRouterKeyInfo(json.openRouterKeyInfo ?? null);
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Analytics</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading analytics...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Data */}
      {data && !loading && (
        <div className="space-y-6">
          {/* Activity KPI tiles */}
          <ActivityTilesRow data={data.activityTiles} />

          {/* Funnels: 2-column */}
          <div className="grid gap-6 lg:grid-cols-2">
            <OpportunityFunnelChart data={data.opportunityFunnel} />
            <RfpFunnelChart data={data.rfpFunnel} />
          </div>

          {/* Revenue & Conversion: 2-column */}
          <div className="grid gap-6 lg:grid-cols-2">
            <RevenueAreaChart data={data.revenue} />
            <ConversionBarChart data={data.conversion} />
          </div>

          {/* Email / AI / Enrichment: 3-column */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <EmailStatsCard data={data.email} />
            <AiUsageCard data={data.aiUsage} openRouterKeyInfo={openRouterKeyInfo} />
            <EnrichmentStatsCard data={data.enrichment} />
          </div>
        </div>
      )}
    </div>
  );
}
