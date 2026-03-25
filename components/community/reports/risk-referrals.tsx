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

interface RiskReferralReport {
  risk_tiers: { tier: string; count: number }[];
  risk_factors: { factor: string; count: number }[];
  referrals_by_status: { status: string; count: number }[];
  referrals_by_service: { service_type: string; count: number }[];
}

const TIER_COLORS: Record<string, string> = {
  low: 'var(--color-green-500)',
  medium: 'var(--color-amber-500)',
  high: 'var(--color-red-500)',
};

const riskConfig = { count: { label: 'Households' } } satisfies ChartConfig;
const factorConfig = { count: { label: 'Households', color: 'var(--color-amber-500)' } } satisfies ChartConfig;
const statusConfig = { count: { label: 'Referrals', color: 'var(--color-blue-500)' } } satisfies ChartConfig;
const serviceConfig = { count: { label: 'Referrals', color: 'var(--color-teal-500)' } } satisfies ChartConfig;

function formatLabel(s: string): string {
  return s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RiskReferralsReportView({ data }: { data?: RiskReferralReport }) {
  const tierData = useMemo(
    () => (data?.risk_tiers ?? []).map((r) => ({
      name: formatLabel(r.tier),
      count: r.count,
      tier: r.tier,
    })),
    [data]
  );

  const factorData = useMemo(
    () => (data?.risk_factors ?? []).map((r) => ({
      name: r.factor.length > 25 ? r.factor.substring(0, 23) + '...' : r.factor,
      fullName: r.factor,
      count: r.count,
    })),
    [data]
  );

  const statusData = useMemo(
    () => (data?.referrals_by_status ?? []).map((r) => ({
      name: formatLabel(r.status),
      count: r.count,
    })),
    [data]
  );

  const serviceData = useMemo(
    () => (data?.referrals_by_service ?? []).map((r) => ({
      name: formatLabel(r.service_type),
      count: r.count,
    })),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk & Referrals</CardTitle>
          <CardDescription>No data yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalHouseholds = tierData.reduce((sum, r) => sum + r.count, 0);
  const highRisk = tierData.find((r) => r.tier === 'high')?.count ?? 0;
  const totalReferrals = statusData.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Households Assessed" value={totalHouseholds.toLocaleString()} />
        <MetricCard label="High Risk" value={highRisk.toLocaleString()} highlight={highRisk > 0} />
        <MetricCard label="Total Referrals" value={totalReferrals.toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk Tier Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Distribution</CardTitle>
            <CardDescription>Household risk tier breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {tierData.length === 0 || totalHouseholds === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={riskConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={tierData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="count"
                      nameKey="name"
                      strokeWidth={2}
                      stroke="var(--background)"
                    >
                      {tierData.map((entry) => (
                        <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] ?? 'var(--color-gray-400)'} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-lg font-semibold">
                      {totalHouseholds}
                    </text>
                    <text x="50%" y="57%" textAnchor="middle" className="fill-muted-foreground text-xs">
                      Households
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
            <div className="mt-2 space-y-1">
              {tierData.map((row) => (
                <div key={row.tier} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[row.tier] ?? 'var(--color-gray-400)' }} />
                    <span>{row.name}</span>
                  </div>
                  <span className="text-muted-foreground">{row.count} ({totalHouseholds > 0 ? Math.round((row.count / totalHouseholds) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Factor Prevalence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Factors</CardTitle>
            <CardDescription>Most common risk indicators across households</CardDescription>
          </CardHeader>
          <CardContent>
            {factorData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={factorConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={factorData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} className="text-xs" width={140} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" name="count" fill="var(--color-amber-500)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Referrals by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referrals by Status</CardTitle>
            <CardDescription>Current referral status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={statusConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={statusData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" name="count" fill="var(--color-blue-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Referrals by Service Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referrals by Service</CardTitle>
            <CardDescription>What services are households being referred to</CardDescription>
          </CardHeader>
          <CardContent>
            {serviceData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={serviceConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={serviceData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} className="text-xs" width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" name="count" fill="var(--color-teal-500)" radius={[0, 4, 4, 0]} />
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
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      No data available.
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${highlight ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
