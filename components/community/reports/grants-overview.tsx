'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface GrantPipelineReport {
  by_status: { status: string; count: number; total_amount: number }[];
  compliance: {
    grant_id: string;
    grant_name: string;
    status: string;
    amount_awarded: number | null;
    total_spend: number;
    budget_utilization_pct: number;
  }[];
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatLabel(s: string): string {
  return s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  researching: 'var(--color-gray-400)',
  preparing: 'var(--color-blue-400)',
  submitted: 'var(--color-blue-500)',
  under_review: 'var(--color-amber-500)',
  awarded: 'var(--color-green-500)',
  active: 'var(--color-green-600)',
  closed: 'var(--color-gray-500)',
  declined: 'var(--color-red-400)',
  not_a_fit: 'var(--color-orange-400)',
};

const pipelineConfig = {
  count: { label: 'Grants', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

const utilizationConfig = {
  utilization: { label: 'Utilization %', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

export function GrantsOverviewReportView({ data }: { data?: GrantPipelineReport }) {
  const pipelineData = useMemo(
    () => (data?.by_status ?? []).map((r) => ({
      name: formatLabel(r.status),
      count: r.count,
      amount: r.total_amount,
      color: STATUS_COLORS[r.status] ?? 'var(--color-gray-400)',
    })),
    [data]
  );

  const complianceData = useMemo(
    () => (data?.compliance ?? []).map((r) => ({
      name: r.grant_name.length > 22 ? r.grant_name.substring(0, 20) + '...' : r.grant_name,
      fullName: r.grant_name,
      utilization: r.budget_utilization_pct,
      awarded: r.amount_awarded ?? 0,
      spent: r.total_spend,
    })),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Grants Overview</CardTitle>
          <CardDescription>No grant data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalGrants = pipelineData.reduce((sum, r) => sum + r.count, 0);
  const totalAwarded = (data.compliance ?? []).reduce((sum, r) => sum + Number(r.amount_awarded ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label="Total Grants" value={totalGrants.toLocaleString()} />
        <MetricCard label="Total Awarded" value={formatCurrency(totalAwarded)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grant Pipeline</CardTitle>
            <CardDescription>Grants by status across the lifecycle</CardDescription>
          </CardHeader>
          <CardContent>
            {pipelineData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={pipelineConfig} className="aspect-auto h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" angle={-30} textAnchor="end" height={60} />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={((value: number, _name: string, item: Record<string, unknown>) => {
                            const payload = (item.payload ?? {}) as Record<string, number>;
                            return `${value} grants (${formatCurrency(payload.amount ?? 0)})`;
                          }) as never}
                        />
                      }
                    />
                    <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                      {pipelineData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget Utilization</CardTitle>
            <CardDescription>Spend vs. award for active grants</CardDescription>
          </CardHeader>
          <CardContent>
            {complianceData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={utilizationConfig} className="aspect-auto h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={complianceData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" domain={[0, 'auto']} tickFormatter={(v: number) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} className="text-xs" width={130} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={((value: number, _name: string, item: Record<string, unknown>) => {
                            const payload = (item.payload ?? {}) as Record<string, number>;
                            return `${value}% (${formatCurrency(payload.spent ?? 0)} of ${formatCurrency(payload.awarded ?? 0)})`;
                          }) as never}
                        />
                      }
                    />
                    <Bar dataKey="utilization" name="utilization" radius={[0, 4, 4, 0]}>
                      {complianceData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            entry.utilization > 100
                              ? 'var(--color-red-500)'
                              : entry.utilization > 80
                                ? 'var(--color-amber-500)'
                                : 'var(--color-green-500)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
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
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      No data available.
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
