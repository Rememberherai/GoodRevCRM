'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Trophy, XCircle, Target } from 'lucide-react';
import { ConversionBarChart } from '@/components/dashboard/conversion-bar-chart';
import { RfpFunnelChart } from '@/components/dashboard/rfp-funnel-chart';
import { ConversionChart } from '@/components/reports/conversion-chart';
import type { AnalyticsData } from '@/types/analytics';
import type { ConversionMetrics } from '@/types/report';

interface ConversionReportViewProps {
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

export function ConversionReportView({ data }: ConversionReportViewProps) {
  const stats = useMemo(() => {
    const totalWon = data.conversion.reduce((sum, c) => sum + Number(c.won_count), 0);
    const totalLost = data.conversion.reduce((sum, c) => sum + Number(c.lost_count), 0);
    const totalOpen = data.conversion.reduce((sum, c) => sum + Number(c.open_count), 0);
    const totalClosed = totalWon + totalLost;
    const winRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;
    const wonValue = data.conversion.reduce((sum, c) => sum + Number(c.won_value), 0);
    const lostValue = data.conversion.reduce((sum, c) => sum + Number(c.lost_value), 0);
    return { totalWon, totalLost, totalOpen, winRate, wonValue, lostValue };
  }, [data.conversion]);

  // Map analytics format to report format
  const conversionMetrics: ConversionMetrics[] = useMemo(() => {
    return data.conversion.map((c) => ({
      month: c.month,
      total_created: Number(c.total_created),
      won_count: Number(c.won_count),
      lost_count: Number(c.lost_count),
      open_count: Number(c.open_count),
      won_value: Number(c.won_value),
      lost_value: Number(c.lost_value),
      win_rate: Number(c.win_rate),
    }));
  }, [data.conversion]);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.winRate}%
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Won ({stats.totalWon})</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stats.wonValue)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Lost ({stats.totalLost})</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(stats.lostValue)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalOpen}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionBarChart data={data.conversion} />
        <RfpFunnelChart data={data.rfpFunnel} />
      </div>

      {/* Conversion Table */}
      <ConversionChart data={conversionMetrics} title="Monthly Conversion Breakdown" />
    </div>
  );
}
