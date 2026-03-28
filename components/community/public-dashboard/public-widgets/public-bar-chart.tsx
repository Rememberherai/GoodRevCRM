'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const FALLBACK_COLORS = ['#0f766e', '#3b82f6', '#a855f7', '#f59e0b', '#f43f5e', '#14b8a6'];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

const chartConfig = { value: { label: 'Value' } } satisfies ChartConfig;

export function PublicBarChart({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; color?: string | null }>;
}) {
  if (items.length === 0) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No aggregate groups met the minimum threshold.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = items.map((item, i) => ({
    name: item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label,
    fullName: item.label,
    value: item.value,
    fill: item.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }));

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>How your support creates change across impact areas.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                tickFormatter={(v: number) => formatCurrency(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                className="text-xs"
                width={110}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={((value: number) => formatCurrency(value)) as never}
                  />
                }
              />
              <Bar dataKey="value" name="value" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
