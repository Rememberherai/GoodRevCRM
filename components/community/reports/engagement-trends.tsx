'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface EngagementTrendsReport {
  monthly_attendance: { month: string; count: number; hours: number }[];
  monthly_households: { month: string; count: number }[];
  monthly_contributions: { month: string; type: string; value: number; count: number }[];
}

const attendanceConfig = {
  count: { label: 'Attendance', color: 'var(--color-blue-500)' },
  hours: { label: 'Hours', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

const householdConfig = {
  count: { label: 'New Households', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

const contribConfig = {
  value: { label: 'Value', color: 'var(--color-purple-500)' },
} satisfies ChartConfig;

function formatMonth(monthStr: string): string {
  try {
    return format(parseISO(monthStr + '-01'), 'MMM yy');
  } catch {
    return monthStr;
  }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function EngagementTrendsReportView({ data }: { data?: EngagementTrendsReport }) {
  const attendanceData = useMemo(
    () => (data?.monthly_attendance ?? []).map((r) => ({
      ...r,
      label: formatMonth(r.month),
    })),
    [data]
  );

  const householdData = useMemo(
    () => (data?.monthly_households ?? []).map((r) => ({
      ...r,
      label: formatMonth(r.month),
    })),
    [data]
  );

  // Aggregate monthly contributions (flatten type breakdown into monthly totals)
  const contribData = useMemo(() => {
    if (!data) return [];
    const monthMap = new Map<string, number>();
    for (const r of data.monthly_contributions) {
      monthMap.set(r.month, (monthMap.get(r.month) ?? 0) + r.value);
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        label: formatMonth(month),
        value,
      }));
  }, [data]);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Engagement Trends</CardTitle>
          <CardDescription>No trend data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Attendance</CardTitle>
          <CardDescription>Attendance records and hours over time</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceData.length === 0 ? (
            <EmptyState />
          ) : (
            <ChartContainer config={attendanceConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={attendanceData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-blue-500)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-blue-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="count"
                    stroke="var(--color-blue-500)"
                    fill="url(#attendanceFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Households</CardTitle>
            <CardDescription>Monthly household registrations</CardDescription>
          </CardHeader>
          <CardContent>
            {householdData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={householdConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={householdData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" name="count" fill="var(--color-green-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribution Value</CardTitle>
            <CardDescription>Monthly total contribution value</CardDescription>
          </CardHeader>
          <CardContent>
            {contribData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={contribConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={contribData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="contribFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-purple-500)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-purple-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={50} tickFormatter={(v: number) => formatCurrency(v)} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={((value: number) => formatCurrency(value)) as never}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="value"
                      stroke="var(--color-purple-500)"
                      fill="url(#contribFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      No trend data available.
    </div>
  );
}
