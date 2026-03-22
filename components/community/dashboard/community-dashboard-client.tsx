'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { startOfYear } from 'date-fns';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import { MetricsCards } from '@/components/community/dashboard/metrics-cards';
import { ImpactRadar } from '@/components/community/dashboard/impact-radar';
import { ProgramCards } from '@/components/community/dashboard/program-cards';
import { ActivityFeed } from '@/components/community/dashboard/activity-feed';
import { MiniMap } from '@/components/community/dashboard/mini-map';
import { PopulationImpact } from '@/components/community/dashboard/population-impact';
import { HouseholdImpact } from '@/components/community/dashboard/household-impact';
import { RiskAlertsPanel } from '@/components/community/dashboard/risk-alerts-panel';
import type { CommunityDashboardData } from '@/lib/community/dashboard';
import type { DateRange } from '@/types/analytics';

interface CommunityDashboardClientProps {
  projectSlug: string;
  initialData: CommunityDashboardData;
  canSeeDetail: boolean;
}

function getYTDRange(): DateRange {
  const today = new Date();
  return {
    from: startOfYear(today),
    to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
  };
}

function formatDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function CommunityDashboardClient({
  projectSlug,
  initialData,
  canSeeDetail,
}: CommunityDashboardClientProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getYTDRange);
  const [data, setData] = useState<CommunityDashboardData>(initialData);
  const [isRefetching, setIsRefetching] = useState(false);
  const hasInitialised = useRef(false);

  const fetchData = useCallback(async (range: DateRange | undefined) => {
    setIsRefetching(true);
    try {
      const params = new URLSearchParams();
      if (range) {
        params.set('startDate', formatDateParam(range.from));
        params.set('endDate', formatDateParam(range.to));
      }
      const response = await fetch(`/api/projects/${projectSlug}/community/dashboard?${params.toString()}`);
      if (response.ok) {
        const json = await response.json() as CommunityDashboardData & { project?: unknown };
        setData(json);
      }
    } catch {
      // Silently fail — keep showing previous data
    } finally {
      setIsRefetching(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    // Skip the initial render — we already have server-rendered data
    if (!hasInitialised.current) {
      hasInitialised.current = true;
      return;
    }
    void fetchData(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Community Dashboard</h2>
          <p className="text-muted-foreground">
            Aggregate community metrics and impact framework tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRefetching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>
      </div>

      <MetricsCards metrics={data.metrics} />

      <div className="grid gap-4 md:grid-cols-2">
        <PopulationImpact {...data.populationImpact} />
        <HouseholdImpact {...data.householdImpact} />
      </div>

      <ImpactRadar dimensions={data.dimensions} />

      {canSeeDetail && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-dashed p-4">
            <div>
              <div className="font-medium">Public Dashboard Preview</div>
              <div className="text-sm text-muted-foreground">See what a fully-populated public dashboard looks like with sample data.</div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectSlug}/public-dashboard-preview`}>
                <Eye className="mr-2 h-4 w-4" />
                View Sample
              </Link>
            </Button>
          </div>

          <MiniMap center={data.miniMap.center} points={data.miniMap.points} />
          <RiskAlertsPanel />
          <div className="grid gap-6 xl:grid-cols-2">
            <ProgramCards programs={data.programs} />
            <ActivityFeed items={data.recentActivity} />
          </div>
        </>
      )}
    </div>
  );
}
