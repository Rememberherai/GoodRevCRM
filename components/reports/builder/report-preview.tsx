'use client';

import * as React from 'react';
import { Loader2, AlertCircle, Table, BarChart3, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { CustomReportResult, CustomChartType, ChartConfig, ReportAggregation, CustomReportConfig } from '@/lib/reports/types';

interface ReportPreviewProps {
  result: CustomReportResult | null;
  loading: boolean;
  error: string | null;
  chartType: CustomChartType;
  chartConfig: ChartConfig;
  aggregations?: ReportAggregation[];
  onRefresh: () => void;
  projectSlug?: string;
  config?: CustomReportConfig | null;
}

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

/**
 * Extract readable values from nested PostgREST embedded objects.
 *
 * Direct FK:  { name: "Acme", industry: "Tech" } → "Acme, Tech"
 * M2M array:  [{ organizations: { name: "Acme" } }] → "Acme"
 * Multiple:   [{ organizations: { name: "Acme" } }, { organizations: { name: "Beta" } }] → "Acme, Beta"
 */
function flattenRelatedValue(value: unknown): string {
  if (value === null || value === undefined) return '—';

  // Direct FK embed: { name: "Acme", industry: "Tech" }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const vals = Object.values(obj)
      .filter((v) => v !== null && v !== undefined && typeof v !== 'object')
      .map(String);
    if (vals.length > 0) return vals.join(', ');
    // Nested object (e.g., M2M inner): recurse
    const nestedVals = Object.values(obj)
      .filter((v) => v !== null && typeof v === 'object')
      .map((v) => flattenRelatedValue(v));
    return nestedVals.filter(Boolean).join(', ');
  }

  // M2M through-table array: [{ organizations: { name: "Acme" } }, ...]
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    const items = value.map((item) => flattenRelatedValue(item)).filter((v) => v && v !== '—');
    return items.length > 0 ? items.join('; ') : '—';
  }

  return String(value);
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(value);
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return flattenRelatedValue(value);
  return String(value);
}

function formatColumnHeader(rawKey: string, aggregations?: ReportAggregation[]): string {
  if (aggregations) {
    const agg = aggregations.find((a) => a.alias === rawKey);
    if (agg) {
      const fieldLabel = agg.fieldName.replace(/_/g, ' ');
      switch (agg.function) {
        case 'sum': return `Total ${fieldLabel}`;
        case 'avg': return `Avg ${fieldLabel}`;
        case 'count': return agg.fieldName === 'id' ? 'Record Count' : `Count of ${fieldLabel}`;
        case 'min': return `Min ${fieldLabel}`;
        case 'max': return `Max ${fieldLabel}`;
        case 'count_distinct': return `Unique ${fieldLabel}`;
      }
    }
  }
  return rawKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DataTable({ result, aggregations }: { result: CustomReportResult; aggregations?: ReportAggregation[] }) {
  if (result.rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Table className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No data found</p>
        <p className="text-sm mt-1">Try adjusting your filters or data source.</p>
      </div>
    );
  }

  // Get column headers from first row
  const headers = result.rows[0] ? Object.keys(result.rows[0]) : [];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/70 border-b">
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left py-2.5 px-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap"
                >
                  {formatColumnHeader(h, aggregations)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b last:border-0 hover:bg-muted/30 transition-colors"
              >
                {headers.map((h) => (
                  <td
                    key={h}
                    className="py-2 px-3 whitespace-nowrap max-w-[300px] truncate"
                  >
                    {formatCellValue(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartView({
  result,
  chartType,
  chartConfig,
}: {
  result: CustomReportResult;
  chartType: CustomChartType;
  chartConfig: ChartConfig;
}) {
  if (result.rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No data to chart</p>
      </div>
    );
  }

  const firstRow = result.rows[0];
  const keys = firstRow ? Object.keys(firstRow) : [];
  // Auto-detect axes: first text/date column for X, first numeric for Y
  const xKey = chartConfig.xAxis && chartConfig.xAxis !== '__auto__'
    ? chartConfig.xAxis
    : keys.find((k) => firstRow && typeof firstRow[k] === 'string') ?? keys[0] ?? '';
  const numericKeys = keys.filter(
    (k) => firstRow && typeof firstRow[k] === 'number' && k !== xKey
  );
  const yKey = chartConfig.yAxis && chartConfig.yAxis !== '__auto__'
    ? chartConfig.yAxis
    : numericKeys[0] ?? keys[1] ?? '';

  const data = result.rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const k of keys) {
      mapped[k] = row[k];
    }
    return mapped;
  });

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {numericKeys.length > 0 ? (
            numericKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))
          ) : (
            <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {numericKeys.length > 0 ? (
            numericKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))
          ) : (
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={150}
            label={(entry) => String((entry as unknown as Record<string, unknown>)[xKey])}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Funnel - render as horizontal bar chart sorted by value
  if (chartType === 'funnel') {
    const sorted = [...data].sort(
      (a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0)
    );
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey={xKey} type="category" width={120} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={yKey} radius={[0, 4, 4, 0]}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return <DataTable result={result} aggregations={[]} />;
}

export function ReportPreview({
  result,
  loading,
  error,
  chartType,
  chartConfig,
  aggregations,
  onRefresh,
  projectSlug,
  config,
}: ReportPreviewProps) {
  const [viewMode, setViewMode] = React.useState<'chart' | 'table'>(
    chartType === 'table' ? 'table' : 'chart'
  );
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    setViewMode(chartType === 'table' ? 'table' : 'chart');
  }, [chartType]);

  const handleExportCsv = async () => {
    if (!projectSlug || !config) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/reports/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Preview
          </h3>
          {result && (
            <Badge variant="secondary" className="text-[10px]">
              {result.totalRows} row{result.totalRows !== 1 ? 's' : ''}
              {result.truncated && ' (truncated)'}
              {' · '}
              {result.executionMs}ms
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {chartType !== 'table' && result && result.rows.length > 0 && (
            <>
              <Button
                variant={viewMode === 'chart' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode('chart')}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Chart
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode('table')}
              >
                <Table className="h-3 w-3 mr-1" />
                Table
              </Button>
            </>
          )}
          {projectSlug && config && result && result.rows.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleExportCsv}
              disabled={exporting}
            >
              <Download className={`h-3 w-3 mr-1 ${exporting ? 'animate-pulse' : ''}`} />
              CSV
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 border rounded-lg bg-muted/10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Running report...</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Report Error</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && !result && (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Select fields and click <strong>Preview</strong> to see your data.
          </p>
        </div>
      )}

      {!loading && !error && result && (
        viewMode === 'chart' && chartType !== 'table' ? (
          <div className="border rounded-lg p-4 bg-card">
            <ChartView result={result} chartType={chartType} chartConfig={chartConfig} />
          </div>
        ) : (
          <DataTable result={result} aggregations={aggregations} />
        )
      )}
    </div>
  );
}
