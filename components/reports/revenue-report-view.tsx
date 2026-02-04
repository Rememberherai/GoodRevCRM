'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Hash, BarChart3 } from 'lucide-react';
import { RevenueAreaChart } from '@/components/dashboard/revenue-area-chart';
import { RevenueChart } from '@/components/reports/revenue-chart';
import type { AnalyticsData } from '@/types/analytics';
import type { RevenueMetrics } from '@/types/report';

interface RevenueReportViewProps {
  data: AnalyticsData;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueReportView({ data }: RevenueReportViewProps) {
  const stats = useMemo(() => {
    const closedWon = data.revenue.reduce((sum, r) => sum + Number(r.closed_won_value), 0);
    const expected = data.revenue.reduce((sum, r) => sum + Number(r.expected_value), 0);
    const dealCount = data.revenue.reduce((sum, r) => sum + Number(r.opportunity_count), 0);
    const avgDeal = dealCount > 0 ? closedWon / dealCount : 0;
    return { closedWon, expected, dealCount, avgDeal };
  }, [data.revenue]);

  // Map analytics format to report format
  const revenueMetrics: RevenueMetrics[] = useMemo(() => {
    return data.revenue.map((r) => ({
      month: r.month,
      closed_won_value: Number(r.closed_won_value),
      expected_value: Number(r.expected_value),
      opportunity_count: Number(r.opportunity_count),
      avg_deal_size: Number(r.avg_deal_size),
    }));
  }, [data.revenue]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Closed Won</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.closedWon)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Expected Value</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(stats.expected)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Deal Count</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.dealCount}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Hash className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(stats.avgDeal)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <BarChart3 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueAreaChart data={data.revenue} />
        <RevenueChart data={revenueMetrics} />
      </div>
    </div>
  );
}
