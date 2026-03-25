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

interface VolunteerImpactReport {
  total_volunteers: number;
  total_hours: number;
  estimated_value: number;
  by_program: { program_id: string; program_name: string; hours: number; volunteers: number }[];
}

const chartConfig = {
  hours: { label: 'Hours', color: 'var(--color-blue-500)' },
  volunteers: { label: 'Workers', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function VolunteerImpactReportView({ data }: { data?: VolunteerImpactReport }) {
  const chartData = useMemo(
    () =>
      (data?.by_program ?? []).map((p) => ({
        name: p.program_name.length > 20 ? p.program_name.substring(0, 18) + '...' : p.program_name,
        fullName: p.program_name,
        hours: p.hours,
        volunteers: p.volunteers,
      })),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Work Hours Impact</CardTitle>
          <CardDescription>No work hours data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Workers" value={data.total_volunteers.toLocaleString()} />
        <MetricCard label="Hours" value={data.total_hours.toFixed(1)} />
        <MetricCard label="Estimated Value" value={formatCurrency(data.estimated_value)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hours by Program</CardTitle>
          <CardDescription>Work hours distribution across programs</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              No work hours program activity yet.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" angle={-30} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={50} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={((value: number, name: string) =>
                          name === 'hours' ? `${value.toFixed(1)} hrs` : `${value} workers`
                        ) as never}
                      />
                    }
                  />
                  <Bar dataKey="hours" name="hours" fill="var(--color-blue-500)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="volunteers" name="volunteers" fill="var(--color-amber-500)" radius={[4, 4, 0, 0]} />
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
