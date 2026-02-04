'use client';

import * as React from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart as LineChartIcon, Loader2 } from 'lucide-react';
import type { ForecastData, ForecastQuarter } from '@/types/report';

interface ForecastingViewProps {
  projectSlug: string;
  userId: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: '#e76f51',
  qualification: '#2a9d8f',
  proposal: '#264653',
  negotiation: '#e9c46a',
};

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
};

const chartConfig: ChartConfig = {
  prospecting: { label: 'Prospecting', color: '#e76f51' },
  qualification: { label: 'Qualification', color: '#2a9d8f' },
  proposal: { label: 'Proposal', color: '#264653' },
  negotiation: { label: 'Negotiation', color: '#e9c46a' },
  historical_actual: { label: 'Historical Actual', color: '#06d6a0' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

export function ForecastingView({ projectSlug, userId }: ForecastingViewProps) {
  const [data, setData] = React.useState<ForecastData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'weighted' | 'unweighted'>('weighted');

  React.useEffect(() => {
    let cancelled = false;

    async function fetchForecast() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (userId) params.set('user_id', userId);

        const res = await fetch(
          `/api/projects/${projectSlug}/reports/forecasting?${params.toString()}`
        );

        if (!res.ok) throw new Error(`Failed to load forecast (${res.status})`);

        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load forecast');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchForecast();
    return () => { cancelled = true; };
  }, [projectSlug, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading forecast data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.quarters.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LineChartIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No forecast data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Open opportunities with expected close dates are needed for forecasting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data based on view mode
  const serverChartData = data.quarters.map((q) => ({
    quarter: q.quarter,
    prospecting: viewMode === 'weighted' ? q.prospecting : q.prospecting,
    qualification: viewMode === 'weighted' ? q.qualification : q.qualification,
    proposal: viewMode === 'weighted' ? q.proposal : q.proposal,
    negotiation: viewMode === 'weighted' ? q.negotiation : q.negotiation,
    total: viewMode === 'weighted' ? q.total_weighted : q.total_unweighted,
    historical_actual: q.historical_actual ?? 0,
  }));

  const totalValue = viewMode === 'weighted'
    ? data.total_pipeline_weighted
    : data.total_pipeline_unweighted;

  const currentQ = data.quarters[0];
  const nextQ = data.quarters.length > 1 ? data.quarters[1] : null;

  return (
    <div className="space-y-6">
      {/* View Mode Toggle + Total */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pipeline Forecast</h3>
          <p className="text-sm text-muted-foreground">
            Next {data.quarters.length} quarters based on open opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg bg-muted p-1">
            <button
              onClick={() => setViewMode('weighted')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                viewMode === 'weighted'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Weighted
            </button>
            <button
              onClick={() => setViewMode('unweighted')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                viewMode === 'unweighted'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unweighted
            </button>
          </div>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Quarterly Revenue Projection</span>
            <span className="text-sm font-normal text-muted-foreground">
              Total: {formatCurrency(totalValue)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={serverChartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatCompact(v)}
                  width={60}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <span>
                          {STAGE_LABELS[name as string] ?? name}: {formatCurrency(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                <Legend
                  formatter={(value: string) => STAGE_LABELS[value] ?? value}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey="prospecting"
                  stackId="pipeline"
                  fill={STAGE_COLORS.prospecting}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="qualification"
                  stackId="pipeline"
                  fill={STAGE_COLORS.qualification}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="proposal"
                  stackId="pipeline"
                  fill={STAGE_COLORS.proposal}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="negotiation"
                  stackId="pipeline"
                  fill={STAGE_COLORS.negotiation}
                  radius={[4, 4, 0, 0]}
                />
                {serverChartData.some((d) => d.historical_actual > 0) && (
                  <Line
                    dataKey="historical_actual"
                    stroke="#06d6a0"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={{ r: 4, fill: '#06d6a0' }}
                    name="Historical Actual"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Quarter Highlight Cards */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {currentQ && (
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Current Quarter - {currentQ.quarter}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(viewMode === 'weighted' ? currentQ.total_weighted : currentQ.total_unweighted)}
              </p>
              <div className="mt-4 space-y-2">
                {Object.entries(STAGE_LABELS).map(([key, label]) => {
                  const val = currentQ[key as keyof ForecastQuarter] as number;
                  const total = viewMode === 'weighted' ? currentQ.total_weighted : currentQ.total_unweighted;
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: STAGE_COLORS[key],
                          minWidth: '8px',
                        }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {label}: {formatCurrency(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {nextQ && (
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Next Quarter - {nextQ.quarter}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(viewMode === 'weighted' ? nextQ.total_weighted : nextQ.total_unweighted)}
              </p>
              <div className="mt-4 space-y-2">
                {Object.entries(STAGE_LABELS).map(([key, label]) => {
                  const val = nextQ[key as keyof ForecastQuarter] as number;
                  const total = viewMode === 'weighted' ? nextQ.total_weighted : nextQ.total_unweighted;
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: STAGE_COLORS[key],
                          minWidth: '8px',
                        }}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {label}: {formatCurrency(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quarterly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Quarter</th>
                  <th className="text-right py-2 px-4 font-medium">Prospecting</th>
                  <th className="text-right py-2 px-4 font-medium">Qualification</th>
                  <th className="text-right py-2 px-4 font-medium">Proposal</th>
                  <th className="text-right py-2 px-4 font-medium">Negotiation</th>
                  <th className="text-right py-2 pl-4 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.quarters.map((q) => (
                  <tr key={q.quarter} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{q.quarter}</td>
                    <td className="text-right py-2 px-4 tabular-nums">{formatCurrency(q.prospecting)}</td>
                    <td className="text-right py-2 px-4 tabular-nums">{formatCurrency(q.qualification)}</td>
                    <td className="text-right py-2 px-4 tabular-nums">{formatCurrency(q.proposal)}</td>
                    <td className="text-right py-2 px-4 tabular-nums">{formatCurrency(q.negotiation)}</td>
                    <td className="text-right py-2 pl-4 font-bold tabular-nums">
                      {formatCurrency(viewMode === 'weighted' ? q.total_weighted : q.total_unweighted)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="py-2 pr-4 font-bold">Total</td>
                  <td className="text-right py-2 px-4 font-bold tabular-nums">
                    {formatCurrency(data.quarters.reduce((sum, q) => sum + q.prospecting, 0))}
                  </td>
                  <td className="text-right py-2 px-4 font-bold tabular-nums">
                    {formatCurrency(data.quarters.reduce((sum, q) => sum + q.qualification, 0))}
                  </td>
                  <td className="text-right py-2 px-4 font-bold tabular-nums">
                    {formatCurrency(data.quarters.reduce((sum, q) => sum + q.proposal, 0))}
                  </td>
                  <td className="text-right py-2 px-4 font-bold tabular-nums">
                    {formatCurrency(data.quarters.reduce((sum, q) => sum + q.negotiation, 0))}
                  </td>
                  <td className="text-right py-2 pl-4 font-bold tabular-nums">
                    {formatCurrency(totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
