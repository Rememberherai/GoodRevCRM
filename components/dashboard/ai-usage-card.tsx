'use client';

import { Brain } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AiUsageStats, AiFeature } from '@/types/analytics';
import { AI_FEATURE_LABELS } from '@/types/analytics';

interface AiUsageCardProps {
  data: AiUsageStats;
  openRouterKeyInfo?: {
    usage: number;
    limit: number | null;
    is_free_tier: boolean;
  } | null;
}

const CHART_COLORS = ['#e76f51', '#2a9d8f', '#264653', '#e9c46a', '#f4a261', '#06d6a0'];

function formatLargeNumber(value: number): string {
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

interface FeatureBreakdown {
  feature: string;
  label: string;
  tokens: number;
  calls: number;
}

function groupByFeature(byModel: AiUsageStats['byModel']): FeatureBreakdown[] {
  const map = new Map<string, { tokens: number; calls: number }>();

  for (const entry of byModel) {
    const existing = map.get(entry.feature);
    if (existing) {
      existing.tokens += entry.total_tokens;
      existing.calls += entry.call_count;
    } else {
      map.set(entry.feature, {
        tokens: entry.total_tokens,
        calls: entry.call_count,
      });
    }
  }

  return Array.from(map.entries()).map(([feature, stats]) => ({
    feature,
    label: AI_FEATURE_LABELS[feature as AiFeature] ?? feature,
    tokens: stats.tokens,
    calls: stats.calls,
  }));
}

export function AiUsageCard({ data, openRouterKeyInfo }: AiUsageCardProps) {
  const hasData = data.totals.totalCalls > 0;
  const featureBreakdown = groupByFeature(data.byModel);

  const pieData = featureBreakdown.map((f) => ({
    name: f.label,
    value: f.tokens,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">AI Usage</CardTitle>
        <Brain className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-bold">
                  {formatLargeNumber(data.totals.totalCalls)}
                </span>
                <span className="ml-1.5 text-sm text-muted-foreground">calls</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatLargeNumber(data.totals.totalTokens)} tokens
              </div>
            </div>

            {openRouterKeyInfo && (
              <div className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                <span>Account: ${openRouterKeyInfo.usage.toFixed(2)} used</span>
                {openRouterKeyInfo.limit != null && (
                  <span> of ${openRouterKeyInfo.limit.toFixed(2)} limit</span>
                )}
                {openRouterKeyInfo.is_free_tier && (
                  <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">
                    Free tier
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-4">
              {/* Pie chart */}
              <div className="h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
                      dataKey="value"
                      strokeWidth={1}
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Feature breakdown */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {featureBreakdown.map((f, index) => (
                  <div key={f.feature} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <span className="truncate text-muted-foreground">
                      {f.label}
                    </span>
                    <span className="ml-auto shrink-0 font-medium tabular-nums">
                      {formatLargeNumber(f.calls)}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatLargeNumber(f.tokens)}t
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
