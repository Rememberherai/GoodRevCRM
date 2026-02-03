'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { FunnelStage } from '@/types/analytics';

interface OpportunityFunnelChartProps {
  data: FunnelStage[];
}

const COLORS = [
  '#e76f51', // chart-1
  '#2a9d8f', // chart-2
  '#264653', // chart-3
  '#e9c46a', // chart-4
  '#f4a261', // chart-5
  '#06d6a0', // chart-6
];

function formatStageName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatValue(value: number): string {
  return `$${value.toLocaleString()}`;
}

const chartConfig: ChartConfig = {
  count: {
    label: 'Count',
    color: 'var(--chart-1)',
  },
};

export function OpportunityFunnelChart({ data }: OpportunityFunnelChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[280px] text-muted-foreground">
            No opportunity data
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((stage) => ({
    ...stage,
    formattedName: formatStageName(stage.name),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunity Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px]">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="formattedName"
                width={110}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(_value, _name, item) => {
                      const payload = item.payload as FunnelStage;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {formatStageName(payload.name)}
                          </span>
                          <span>Count: {payload.count}</span>
                          <span>Value: {formatValue(payload.value)}</span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
