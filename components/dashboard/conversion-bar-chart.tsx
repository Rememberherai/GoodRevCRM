'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { ConversionMetric } from '@/types/analytics';

interface ConversionBarChartProps {
  data: ConversionMetric[];
}

const chartConfig = {
  won: {
    label: 'Won',
    color: 'var(--color-green-500)',
  },
  lost: {
    label: 'Lost',
    color: 'var(--color-red-500)',
  },
  open: {
    label: 'Open',
    color: 'var(--color-gray-400)',
  },
  winRate: {
    label: 'Win Rate',
    color: 'var(--color-amber-500)',
  },
} satisfies ChartConfig;

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatMonth(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'MMM');
  } catch {
    return dateStr;
  }
}

export function ConversionBarChart({ data }: ConversionBarChartProps) {
  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) => a.month.localeCompare(b.month)).map((d) => ({
        ...d,
        monthLabel: formatMonth(d.month),
      })),
    [data]
  );

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Win/Loss Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No conversion data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win/Loss Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={sortedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                className="text-xs"
                width={45}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={((value: number, name: string, item: Record<string, unknown>) => {
                      if (name === 'win_rate') return `Win Rate: ${value.toFixed(1)}%`;
                      const payload = (item.payload ?? {}) as Record<string, number>;
                      const labels: Record<string, string> = {
                        won_count: `Won: ${value} (${formatCurrency(payload.won_value ?? 0)})`,
                        lost_count: `Lost: ${value} (${formatCurrency(payload.lost_value ?? 0)})`,
                        open_count: `Open: ${value}`,
                      };
                      return labels[name] ?? `${name}: ${value}`;
                    }) as never}
                  />
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="won_count"
                name="won"
                stackId="deals"
                fill="var(--color-green-500)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="lost_count"
                name="lost"
                stackId="deals"
                fill="var(--color-red-500)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="open_count"
                name="open"
                stackId="deals"
                fill="var(--color-gray-400)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="win_rate"
                name="winRate"
                stroke="var(--color-amber-500)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
