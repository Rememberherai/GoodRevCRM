'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { SeriesReport } from '@/lib/community/reports';

const trendConfig = {
  registrations: { label: 'Registrations', color: 'var(--color-blue-500)' },
  checked_in: { label: 'Checked In', color: 'var(--color-green-500)' },
} satisfies ChartConfig;

const retentionConfig = {
  retention_rate: { label: 'Retention %', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

const CATEGORY_COLORS: Record<string, string> = {
  feedback: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  observation: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  general: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900',
};

interface SeriesReportViewProps {
  data?: SeriesReport | null;
  onBack?: () => void;
}

export function SeriesReportView({ data, onBack }: SeriesReportViewProps) {
  const trendData = useMemo(
    () => (data?.attendance_trend ?? []).map((r) => ({
      ...r,
      label: r.starts_at ? format(parseISO(r.starts_at), 'MMM d') : `#${r.event_id.slice(0, 4)}`,
    })),
    [data]
  );

  const retentionData = useMemo(
    () => (data?.retention ?? []).map((r) => ({
      ...r,
      label: `#${r.instance_number}`,
    })),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Series Report</CardTitle>
          <CardDescription>Series not found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h3 className="text-lg font-semibold">{data.title}</h3>
          <p className="text-sm text-muted-foreground capitalize">
            {data.recurrence_frequency} series
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Instances" value={data.total_instances} />
        <KpiCard label="Series Registrations" value={data.total_series_registrations} />
        <KpiCard label="Total Notes" value={data.notes_summary.total_notes} />
        <KpiCard
          label="Avg Attendance Rate"
          value={
            data.attendance_trend.length > 0
              ? `${Math.round(data.attendance_trend.reduce((sum, t) => sum + t.attendance_rate, 0) / data.attendance_trend.length)}%`
              : '—'
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Attendance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance Trend</CardTitle>
            <CardDescription>Registrations and check-ins per instance</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={trendConfig} className="aspect-auto h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="registrations" name="registrations" stroke="var(--color-blue-500)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="checked_in" name="checked_in" stroke="var(--color-green-500)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Series Retention</CardTitle>
            <CardDescription>% of series registrants attending each instance</CardDescription>
          </CardHeader>
          <CardContent>
            {retentionData.length === 0 || data.total_series_registrations === 0 ? (
              <EmptyState msg="No series registrations to track retention." />
            ) : (
              <ChartContainer config={retentionConfig} className="aspect-auto h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={retentionData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <ChartTooltip content={<ChartTooltipContent formatter={((v: number) => `${v}%`) as never} />} />
                    <Line type="monotone" dataKey="retention_rate" name="retention_rate" stroke="var(--color-amber-500)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instance Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Instance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium text-right">Date</th>
                  <th className="pb-2 pr-4 font-medium text-right">Registrations</th>
                  <th className="pb-2 pr-4 font-medium text-right">Checked In</th>
                  <th className="pb-2 pr-4 font-medium text-right">Attendance %</th>
                  <th className="pb-2 font-medium text-right">Retention %</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance_trend.map((instance, i) => {
                  const ret = data.retention[i];
                  return (
                    <tr key={instance.event_id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium">{instance.title}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {instance.starts_at ? format(parseISO(instance.starts_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right">{instance.registrations}</td>
                      <td className="py-2 pr-4 text-right">{instance.checked_in}</td>
                      <td className="py-2 pr-4 text-right">
                        <Badge variant={instance.attendance_rate >= 70 ? 'default' : instance.attendance_rate >= 40 ? 'secondary' : 'outline'}>
                          {instance.attendance_rate}%
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {ret ? `${ret.retention_rate}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notes Summary */}
      {data.notes_summary.total_notes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes Summary</CardTitle>
            <CardDescription>
              {data.notes_summary.total_notes} note{data.notes_summary.total_notes !== 1 ? 's' : ''} across all instances
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category breakdown */}
            <div className="flex flex-wrap gap-2">
              {data.notes_summary.by_category.map((cat) => (
                <Badge key={cat.category} variant="secondary">
                  {cat.category}: {cat.count}
                </Badge>
              ))}
            </div>

            {/* Recent notes */}
            {data.notes_summary.recent_notes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent Notes</p>
                {data.notes_summary.recent_notes.map((note, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{note.event_title}</span>
                      {note.category && (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.general}`}>
                          {note.category}
                        </span>
                      )}
                      <span>{format(parseISO(note.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <p className="mt-1 text-sm">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ msg }: { msg?: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {msg ?? 'No data available.'}
    </div>
  );
}
