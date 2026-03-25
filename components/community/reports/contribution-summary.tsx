'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

interface ContributionSummaryReport {
  by_type: { type: string; count: number; total_value: number; total_hours: number }[];
  by_dimension: { dimension_id: string; dimension_label: string; count: number; total_value: number }[];
  by_status: { status: string; count: number; total_value: number }[];
}

const TYPE_COLORS = [
  'var(--color-blue-500)',
  'var(--color-green-500)',
  'var(--color-amber-500)',
  'var(--color-purple-500)',
  'var(--color-red-400)',
  'var(--color-teal-500)',
];

const STATUS_COLORS: Record<string, string> = {
  pledged: 'var(--color-amber-500)',
  received: 'var(--color-blue-500)',
  completed: 'var(--color-green-500)',
  cancelled: 'var(--color-red-400)',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLabel(s: string): string {
  return s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const typeConfig = { value: { label: 'Value' } } satisfies ChartConfig;
const dimConfig = { value: { label: 'Value', color: 'var(--color-blue-500)' } } satisfies ChartConfig;
const statusConfig = { value: { label: 'Value' } } satisfies ChartConfig;

export function ContributionSummaryReportView({ data }: { data?: ContributionSummaryReport }) {
  const grandTotal = useMemo(
    () => (data?.by_type ?? []).reduce((sum, r) => sum + r.total_value, 0),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution Summary</CardTitle>
          <CardDescription>No contribution data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const typeChartData = data.by_type.map((r) => ({
    name: formatLabel(r.type),
    value: r.total_value,
    count: r.count,
  }));

  const dimChartData = data.by_dimension.map((r) => ({
    name: r.dimension_label.length > 18 ? r.dimension_label.substring(0, 16) + '...' : r.dimension_label,
    fullName: r.dimension_label,
    value: r.total_value,
    count: r.count,
  }));

  const statusChartData = data.by_status.map((r) => ({
    name: formatLabel(r.status),
    value: r.total_value,
    count: r.count,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* By Type - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Type</CardTitle>
            <CardDescription>Contribution value by category</CardDescription>
          </CardHeader>
          <CardContent>
            {typeChartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={typeConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {typeChartData.map((_, index) => (
                        <Cell key={index} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={((value: number) => formatCurrency(value)) as never}
                        />
                      }
                    />
                    <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-sm font-semibold">
                      {formatCurrency(grandTotal)}
                    </text>
                    <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-xs">
                      Total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
            <div className="mt-2 space-y-1">
              {typeChartData.map((row, i) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                    <span className="capitalize">{row.name}</span>
                  </div>
                  <span className="text-muted-foreground">{row.count} &bull; {formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Dimension - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Dimension</CardTitle>
            <CardDescription>Impact dimensions by value</CardDescription>
          </CardHeader>
          <CardContent>
            {dimChartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={dimConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dimChartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" tickFormatter={(v: number) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} className="text-xs" width={100} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={((value: number) => formatCurrency(value)) as never}
                        />
                      }
                    />
                    <Bar dataKey="value" name="value" fill="var(--color-blue-500)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* By Status - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Status</CardTitle>
            <CardDescription>Pledged, received, completed, cancelled</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={statusConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="value"
                      nameKey="name"
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {statusChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name.toLowerCase()] ?? 'var(--color-gray-400)'}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={((value: number) => formatCurrency(value)) as never}
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
            <div className="mt-2 space-y-1">
              {statusChartData.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[row.name.toLowerCase()] ?? 'var(--color-gray-400)' }}
                    />
                    <span>{row.name}</span>
                  </div>
                  <span className="text-muted-foreground">{row.count} &bull; {formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}
