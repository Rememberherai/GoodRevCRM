'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
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
import type { RevenueMetric } from '@/types/analytics';

interface RevenueAreaChartProps {
  data: RevenueMetric[];
}

const chartConfig = {
  closedWon: {
    label: 'Closed Won',
    color: 'var(--color-green-500)',
  },
  expected: {
    label: 'Expected Revenue',
    color: 'var(--color-blue-500)',
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

export function RevenueAreaChart({ data }: RevenueAreaChartProps) {
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
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No revenue data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sortedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-green-500)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-green-500)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-blue-500)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-blue-500)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCurrency(v)}
                className="text-xs"
                width={60}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={((value: number, name: string) => {
                      const label =
                        name === 'closed_won_value' ? 'Closed Won' : 'Expected Revenue';
                      return `${label}: ${formatCurrency(value)}`;
                    }) as never}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="closed_won_value"
                name="closedWon"
                stroke="var(--color-green-500)"
                fill="url(#fillGreen)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expected_value"
                name="expected"
                stroke="var(--color-blue-500)"
                fill="url(#fillBlue)"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
