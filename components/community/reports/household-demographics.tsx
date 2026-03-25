'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface HouseholdDemographicsReport {
  total_households: number;
  total_members: number;
  avg_household_size: number;
  by_city: { city: string; count: number }[];
}

const cityConfig = {
  count: { label: 'Households', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

export function HouseholdDemographicsReportView({ data }: { data?: HouseholdDemographicsReport }) {
  const chartData = useMemo(() => {
    if (!data) return [];
    const top10 = data.by_city.slice(0, 10);
    const rest = data.by_city.slice(10);
    if (rest.length > 0) {
      const otherCount = rest.reduce((sum, r) => sum + r.count, 0);
      top10.push({ city: 'Other', count: otherCount });
    }
    return top10;
  }, [data]);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Household Demographics</CardTitle>
          <CardDescription>No household data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Households" value={data.total_households.toLocaleString()} />
        <MetricCard label="Members" value={data.total_members.toLocaleString()} />
        <MetricCard label="Avg Size" value={data.avg_household_size.toFixed(1)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Households by City</CardTitle>
          <CardDescription>Geographic distribution of registered households</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No location data yet.
            </div>
          ) : (
            <ChartContainer config={cityConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis type="category" dataKey="city" tickLine={false} axisLine={false} className="text-xs" width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" name="count" fill="var(--color-blue-500)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
