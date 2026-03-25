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

interface ContractorHoursReport {
  total_contractors: number;
  total_hours: number;
  by_contractor: {
    contractor_id: string;
    contractor_name: string;
    hours: number;
    jobs: number;
    out_of_scope_jobs: number;
  }[];
}

const chartConfig = {
  hours: { label: 'Hours', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

export function ContractorHoursReportView({ data }: { data?: ContractorHoursReport }) {
  const chartData = useMemo(
    () =>
      (data?.by_contractor ?? []).map((c) => ({
        name: c.contractor_name.length > 22 ? c.contractor_name.substring(0, 20) + '...' : c.contractor_name,
        fullName: c.contractor_name,
        hours: c.hours,
        jobs: c.jobs,
        outOfScope: c.out_of_scope_jobs,
      })),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contractor Hours</CardTitle>
          <CardDescription>No contractor hour data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Contractors" value={data.total_contractors.toLocaleString()} />
        <MetricCard label="Total Hours" value={data.total_hours.toFixed(1)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hours by Contractor</CardTitle>
          <CardDescription>Tracked hours per contractor</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No contractor entries yet.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} className="text-xs" width={130} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={((value: number, _name: string, item: Record<string, unknown>) => {
                          const payload = (item.payload ?? {}) as Record<string, number>;
                          return `${value.toFixed(1)} hrs (${payload.jobs ?? 0} jobs, ${payload.outOfScope ?? 0} out-of-scope)`;
                        }) as never}
                      />
                    }
                  />
                  <Bar dataKey="hours" name="hours" fill="var(--color-blue-500)" radius={[0, 4, 4, 0]} />
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
