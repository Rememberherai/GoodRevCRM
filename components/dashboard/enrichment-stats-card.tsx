'use client';

import { Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { EnrichmentStats } from '@/types/analytics';

interface EnrichmentStatsCardProps {
  data: EnrichmentStats;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

export function EnrichmentStatsCard({ data }: EnrichmentStatsCardProps) {
  const hasData = data.job_count > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Enrichment</CardTitle>
        <Database className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <>
            <div>
              <div className="text-2xl font-bold">
                {formatNumber(data.total_credits)}
              </div>
              <p className="text-xs text-muted-foreground">
                credits used across {formatNumber(data.job_count)} jobs
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium">{data.success_rate.toFixed(1)}%</span>
              </div>
              <Progress
                value={Math.min(data.success_rate, 100)}
                className="h-2 bg-green-500/20 [&>[data-slot=progress-indicator]]:bg-green-500"
              />
            </div>

            <div className="flex items-center gap-6 text-sm pt-2 border-t">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(data.completed_count)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Failed</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(data.failed_count)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
