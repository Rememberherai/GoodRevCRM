'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { EventOverviewReport } from '@/lib/community/reports';

const statusConfig = {
  published: { label: 'Published', color: 'var(--color-blue-500)' },
  completed: { label: 'Completed', color: 'var(--color-green-500)' },
  draft: { label: 'Draft', color: 'var(--color-gray-400)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-red-400)' },
  postponed: { label: 'Postponed', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

const monthlyConfig = {
  count: { label: 'Events', color: 'var(--color-blue-500)' },
  registrations: { label: 'Registrations', color: 'var(--color-green-500)' },
  check_ins: { label: 'Check-ins', color: 'var(--color-amber-500)' },
} satisfies ChartConfig;

const newReturnConfig = {
  new_attendees: { label: 'New', color: 'var(--color-green-500)' },
  returning_attendees: { label: 'Returning', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

const PIE_COLORS = [
  'var(--color-blue-500)',
  'var(--color-green-500)',
  'var(--color-amber-500)',
  'var(--color-purple-500)',
  'var(--color-red-400)',
  'var(--color-cyan-500)',
];

const sourceConfig = {
  source: { label: 'Source', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

function formatMonth(monthStr: string): string {
  try {
    return format(parseISO(monthStr + '-01'), 'MMM yy');
  } catch {
    return monthStr;
  }
}

interface EventOverviewReportViewProps {
  data?: EventOverviewReport;
  onDrillDown: (eventId: string) => void;
  onSeriesDrillDown?: (seriesId: string) => void;
}

export function EventOverviewReportView({ data, onDrillDown, onSeriesDrillDown }: EventOverviewReportViewProps) {
  const monthlyData = useMemo(
    () => (data?.monthly_events ?? []).map((r) => ({ ...r, label: formatMonth(r.month) })),
    [data]
  );

  const sourceData = useMemo(
    () => (data?.by_source ?? []).map((r, i) => ({ ...r, fill: PIE_COLORS[i % PIE_COLORS.length] })),
    [data]
  );

  const newReturnData = useMemo(
    () => (data?.new_vs_returning_by_month ?? []).map((r) => ({ ...r, label: formatMonth(r.month) })),
    [data]
  );

  if (!data || data.total_events === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Events Overview</CardTitle>
          <CardDescription>No events found in the selected date range.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total Events" value={data.total_events} />
        <KpiCard label="Registrations" value={data.total_registrations} />
        <KpiCard label="Check-ins" value={data.total_check_ins} />
        <KpiCard label="Avg Attendance" value={`${data.avg_attendance_rate}%`} />
        <KpiCard label="Unique Participants" value={data.unduplicated_event_participants} />
        <KpiCard label="New Attendees" value={data.new_attendees} className="border-green-200 dark:border-green-800" />
        <KpiCard label="Returning Attendees" value={data.returning_attendees} className="border-blue-200 dark:border-blue-800" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Events by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusConfig} className="aspect-auto h-[240px] w-full">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.by_status} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                    {data.by_status.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={(statusConfig as Record<string, { color: string }>)[entry.status]?.color ?? 'var(--color-gray-400)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Registrations by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrations by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={sourceConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={sourceData}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={((props: { source: string; count: number }) => `${props.source} (${props.count})`) as never}
                    >
                      {sourceData.map((entry) => (
                        <Cell key={entry.source} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New vs Returning Trend */}
      {newReturnData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New vs Returning Attendees</CardTitle>
            <CardDescription>Unique checked-in attendees per month, deduplicated</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={newReturnConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={newReturnData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="new_attendees" name="new_attendees" stackId="a" fill="var(--color-green-500)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="returning_attendees" name="returning_attendees" stackId="a" fill="var(--color-blue-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Event Activity</CardTitle>
          <CardDescription>Events, registrations, and check-ins over time</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <EmptyState />
          ) : (
            <ChartContainer config={monthlyConfig} className="aspect-auto h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-green-500)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-green-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={40} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="registrations" name="registrations" stroke="var(--color-green-500)" fill="url(#regFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="check_ins" name="check_ins" stroke="var(--color-amber-500)" fill="none" strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Comparison */}
      {data.by_category_stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Comparison</CardTitle>
            <CardDescription>Attendance stats by event category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium text-right">Events</th>
                    <th className="pb-2 pr-4 font-medium text-right">Registrations</th>
                    <th className="pb-2 pr-4 font-medium text-right">Check-ins</th>
                    <th className="pb-2 pr-4 font-medium text-right">Attendance %</th>
                    <th className="pb-2 pr-4 font-medium text-right">Unique</th>
                    <th className="pb-2 pr-4 font-medium text-right">New</th>
                    <th className="pb-2 font-medium text-right">Returning</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_category_stats.map((cat) => (
                    <tr key={cat.category} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium capitalize">{cat.category}</td>
                      <td className="py-2 pr-4 text-right">{cat.event_count}</td>
                      <td className="py-2 pr-4 text-right">{cat.registrations}</td>
                      <td className="py-2 pr-4 text-right">{cat.check_ins}</td>
                      <td className="py-2 pr-4 text-right">
                        <Badge variant={cat.attendance_rate >= 70 ? 'default' : cat.attendance_rate >= 40 ? 'secondary' : 'outline'}>
                          {cat.attendance_rate}%
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">{cat.unique_participants}</td>
                      <td className="py-2 pr-4 text-right text-green-600 dark:text-green-400">{cat.new_attendees}</td>
                      <td className="py-2 text-right text-blue-600 dark:text-blue-400">{cat.returning_attendees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Events by Attendance</CardTitle>
          <CardDescription>Click an event to view its detailed report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Event</th>
                  <th className="pb-2 pr-4 font-medium text-right">Date</th>
                  <th className="pb-2 pr-4 font-medium text-right">Registrations</th>
                  <th className="pb-2 pr-4 font-medium text-right">Checked In</th>
                  <th className="pb-2 pr-4 font-medium text-right">Attendance %</th>
                  <th className="pb-2 font-medium text-right">Capacity %</th>
                </tr>
              </thead>
              <tbody>
                {data.top_events_by_attendance.map((event) => (
                  <tr
                    key={event.event_id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                    onClick={() => onDrillDown(event.event_id)}
                  >
                    <td className="py-2 pr-4 font-medium">
                      <span className="flex items-center gap-2">
                        {event.title}
                        {event.series_id && onSeriesDrillDown && (
                          <Badge
                            variant="outline"
                            className="cursor-pointer text-xs hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeriesDrillDown(event.series_id!);
                            }}
                          >
                            Series
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {event.starts_at ? format(parseISO(event.starts_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right">{event.registrations}</td>
                    <td className="py-2 pr-4 text-right">{event.checked_in}</td>
                    <td className="py-2 pr-4 text-right">
                      <Badge variant={event.attendance_rate >= 70 ? 'default' : event.attendance_rate >= 40 ? 'secondary' : 'outline'}>
                        {event.attendance_rate}%
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {event.capacity_utilization !== null ? `${event.capacity_utilization}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      No data available.
    </div>
  );
}
