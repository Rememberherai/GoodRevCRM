'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const TYPE_COLORS: Record<string, string> = {
  monetary: 'var(--color-green-500, #22c55e)',
  in_kind: 'var(--color-blue-500, #3b82f6)',
  volunteer_hours: 'var(--color-amber-500, #f59e0b)',
  grant: 'var(--color-purple-500, #a855f7)',
  service: 'var(--color-teal-500, #14b8a6)',
};

const FALLBACK_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#14b8a6', '#f43f5e'];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatLabel(s: string): string {
  return s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const chartConfig = { value: { label: 'Value' } } satisfies ChartConfig;

export function PublicContributionSummary({
  title,
  items,
}: {
  title: string;
  items: Array<{ type: string; totalValue: number; count: number }>;
}) {
  const grandTotal = useMemo(
    () => items.reduce((sum, r) => sum + r.totalValue, 0),
    [items],
  );

  const chartData = items.map((item, i) => ({
    name: formatLabel(item.type),
    value: item.totalValue,
    count: item.count,
    fill: TYPE_COLORS[item.type] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  if (items.length === 0) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No contribution groups met the publication threshold.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Every dollar, every hour, every gift moves the mission forward.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                strokeWidth={2}
                stroke="var(--background)"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={((value: number) => formatCurrency(value)) as never}
                  />
                }
              />
              <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-lg font-semibold">
                {formatCurrency(grandTotal)}
              </text>
              <text x="50%" y="55%" textAnchor="middle" className="fill-muted-foreground text-xs">
                Total Impact
              </text>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="mt-4 space-y-2">
          {chartData.map((row) => (
            <div key={row.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: row.fill }} />
                <span>{row.name}</span>
              </div>
              <span className="text-muted-foreground">{row.count.toLocaleString()} &bull; {formatCurrency(row.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
