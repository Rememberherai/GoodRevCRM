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
import { ArrowLeft, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { IndividualEventReport } from '@/lib/community/reports';

const timelineConfig = {
  cumulative: { label: 'Registrations', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

const sourceConfig = {
  source: { label: 'Source', color: 'var(--color-blue-500)' },
} satisfies ChartConfig;

const ticketConfig = {
  count: { label: 'Tickets', color: 'var(--color-purple-500)' },
} satisfies ChartConfig;

const PIE_COLORS = [
  'var(--color-blue-500)',
  'var(--color-green-500)',
  'var(--color-amber-500)',
  'var(--color-purple-500)',
  'var(--color-red-400)',
  'var(--color-cyan-500)',
];

const CATEGORY_COLORS: Record<string, string> = {
  feedback: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  observation: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950',
  general: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900',
};

interface EventDetailReportViewProps {
  data?: IndividualEventReport | null;
  onBack?: () => void;
}

export function EventDetailReportView({ data, onBack }: EventDetailReportViewProps) {
  const timelineData = useMemo(
    () => (data?.registration_timeline ?? []).map((r) => ({
      ...r,
      label: format(parseISO(r.date), 'MMM d'),
    })),
    [data]
  );

  const sourceData = useMemo(
    () => (data?.source_breakdown ?? []).map((r, i) => ({ ...r, fill: PIE_COLORS[i % PIE_COLORS.length] })),
    [data]
  );

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Report</CardTitle>
          <CardDescription>Event not found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const funnel = data.registration_funnel;
  const confirmedPct = funnel.total_registered > 0 ? Math.round((funnel.confirmed / funnel.total_registered) * 100) : 0;
  const checkedInPct = funnel.confirmed > 0 ? Math.round((funnel.checked_in / funnel.confirmed) * 100) : 0;

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
          <p className="text-sm text-muted-foreground">
            {data.starts_at ? format(parseISO(data.starts_at), 'MMMM d, yyyy') : '—'}
            {data.ends_at && ` — ${format(parseISO(data.ends_at), 'MMMM d, yyyy')}`}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">{data.status}</Badge>
      </div>

      {/* Registration Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registration Funnel</CardTitle>
          <CardDescription>From registration to attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <FunnelStep
              label="Registered"
              value={funnel.total_registered}
              pct={100}
            />
            <FunnelStep
              label="Confirmed"
              value={funnel.confirmed}
              pct={confirmedPct}
            />
            <FunnelStep
              label="Checked In"
              value={funnel.checked_in}
              pct={checkedInPct}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Cancelled" value={funnel.cancelled} />
            <Metric label="Waitlisted" value={funnel.waitlisted} />
            <Metric label="Pending Approval" value={funnel.pending_approval} />
            <Metric label="Pending Waiver" value={funnel.pending_waiver} />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Registration Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration Timeline</CardTitle>
            <CardDescription>Cumulative registrations over time</CardDescription>
          </CardHeader>
          <CardContent>
            {timelineData.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={timelineConfig} className="aspect-auto h-[240px] w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={timelineData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-blue-500)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-blue-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="cumulative" name="cumulative" stroke="var(--color-blue-500)" fill="url(#timelineFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration Source</CardTitle>
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

      {/* Ticket Type Breakdown */}
      {data.ticket_type_breakdown.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ticket Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ticketConfig} className="aspect-auto h-[200px] w-full">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.ticket_type_breakdown} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="ticket_type" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickLine={false} axisLine={false} className="text-xs" width={35} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" name="count" fill="var(--color-purple-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Waiver Completion */}
      {data.waiver_completion_rate !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waiver Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={data.waiver_completion_rate} className="flex-1" />
              <span className="text-sm font-medium">{data.waiver_completion_rate}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes / Feedback */}
      {data.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes & Feedback</CardTitle>
            <CardDescription>{data.notes.length} note{data.notes.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notes.map((note) => (
              <div key={note.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {note.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
                  {note.category && (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.general}`}>
                      {note.category}
                    </span>
                  )}
                  <span>{note.created_by_name}</span>
                  <span>{format(parseISO(note.created_at), 'MMM d, yyyy')}</span>
                </div>
                <p className="mt-1 text-sm">{note.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FunnelStep({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4 text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{pct}%</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
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
