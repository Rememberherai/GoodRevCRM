'use client';

import { Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { EmailPerformance } from '@/types/analytics';

interface EmailStatsCardProps {
  data: EmailPerformance;
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

const rateBars = [
  { key: 'open_rate' as const, label: 'Open Rate', color: 'bg-blue-500', trackColor: 'bg-blue-500/20' },
  { key: 'click_rate' as const, label: 'Click Rate', color: 'bg-green-500', trackColor: 'bg-green-500/20' },
  { key: 'reply_rate' as const, label: 'Reply Rate', color: 'bg-purple-500', trackColor: 'bg-purple-500/20' },
  { key: 'bounce_rate' as const, label: 'Bounce Rate', color: 'bg-red-500', trackColor: 'bg-red-500/20' },
] as const;

export function EmailStatsCard({ data }: EmailStatsCardProps) {
  const hasData = data.total_sent > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Email Performance</CardTitle>
        <Mail className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {formatNumber(data.total_sent)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                sent
              </span>
            </div>

            <div className="space-y-3">
              {rateBars.map(({ key, label, color, trackColor }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{data[key].toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={Math.min(data[key], 100)}
                    className={`h-2 ${trackColor} [&>[data-slot=progress-indicator]]:${color}`}
                  />
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              {formatNumber(data.total_opens)} opens{' '}
              <span className="mx-1">&middot;</span>
              {formatNumber(data.total_clicks)} clicks{' '}
              <span className="mx-1">&middot;</span>
              {formatNumber(data.total_replies)} replies{' '}
              <span className="mx-1">&middot;</span>
              {formatNumber(data.total_bounces)} bounces
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
