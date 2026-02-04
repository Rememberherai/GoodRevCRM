'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Mail,
  Calendar,
  Target,
  ArrowDown,
  Loader2,
  PhoneOff,
  MessageSquare,
  UserCheck,
  MousePointerClick,
  Reply,
  Eye,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { ActivityTilesRow } from '@/components/dashboard/activity-tiles';
import { EmailStatsCard } from '@/components/dashboard/email-stats-card';
import type { AnalyticsData, DateRange, ActivityConversionMetrics } from '@/types/analytics';

interface ActivityReportViewProps {
  data: AnalyticsData;
  projectSlug: string;
  dateRange: DateRange | undefined;
  userId: string | null;
}

// Industry benchmarks (B2B enterprise averages)
const BENCHMARKS: Record<string, { avg: number; good: number }> = {
  dial_to_connect: { avg: 5, good: 8 },
  connect_to_meeting: { avg: 15, good: 25 },
  meeting_show_rate: { avg: 80, good: 90 },
  meeting_to_opp: { avg: 30, good: 40 },
  email_open_rate: { avg: 25, good: 35 },
  email_click_rate: { avg: 3, good: 5 },
  email_reply_rate: { avg: 5, good: 10 },
  reply_to_meeting: { avg: 20, good: 30 },
  proposal_to_opp: { avg: 50, good: 65 },
};

function rateColor(rate: number, benchmarkKey: string): string {
  const b = BENCHMARKS[benchmarkKey];
  if (!b) return 'bg-muted text-muted-foreground';
  if (rate >= b.good) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (rate >= b.avg) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function calcPct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function fmtPct(value: number): string {
  return `${value}%`;
}

interface FunnelStep {
  label: string;
  value: number;
  icon: React.ElementType;
}

interface FunnelRate {
  label: string;
  rate: number;
  benchmarkKey: string;
}

function ConversionFunnelCard({
  title,
  titleIcon: TitleIcon,
  titleColor,
  steps,
  rates,
}: {
  title: string;
  titleIcon: React.ElementType;
  titleColor: string;
  steps: FunnelStep[];
  rates: FunnelRate[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${titleColor}`}>
            <TitleIcon className="h-3.5 w-3.5" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-0">
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              {/* Step row */}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <step.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                <span className="text-lg font-bold tabular-nums">{step.value.toLocaleString()}</span>
              </div>
              {/* Rate arrow between steps */}
              {i < rates.length && (() => {
                const r = rates[i]!;
                return (
                  <div className="flex items-center gap-2 py-1 pl-3">
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    <Badge
                      variant="secondary"
                      className={`text-xs font-medium ${rateColor(r.rate, r.benchmarkKey)}`}
                    >
                      {fmtPct(r.rate)} {r.label}
                    </Badge>
                  </div>
                );
              })()}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionSummaryTable({ metrics }: { metrics: ActivityConversionMetrics }) {
  const rows = [
    {
      funnel: 'Call',
      from: 'Calls Made',
      to: 'Connects',
      countFrom: metrics.calls_made,
      countTo: metrics.call_connects,
      benchmarkKey: 'dial_to_connect',
    },
    {
      funnel: 'Call',
      from: 'Connects',
      to: 'Meetings Booked',
      countFrom: metrics.call_connects,
      countTo: metrics.call_meetings_booked,
      benchmarkKey: 'connect_to_meeting',
    },
    {
      funnel: 'Email',
      from: 'Emails Sent',
      to: 'Opened',
      countFrom: metrics.emails_sent,
      countTo: metrics.emails_opened,
      benchmarkKey: 'email_open_rate',
    },
    {
      funnel: 'Email',
      from: 'Opened',
      to: 'Clicked',
      countFrom: metrics.emails_opened,
      countTo: metrics.emails_clicked,
      benchmarkKey: 'email_click_rate',
    },
    {
      funnel: 'Email',
      from: 'Emails Sent',
      to: 'Replied',
      countFrom: metrics.emails_sent,
      countTo: metrics.emails_replied,
      benchmarkKey: 'email_reply_rate',
    },
    {
      funnel: 'Meeting',
      from: 'Booked',
      to: 'Attended',
      countFrom: metrics.meetings_booked,
      countTo: metrics.meetings_attended,
      benchmarkKey: 'meeting_show_rate',
    },
    {
      funnel: 'Meeting',
      from: 'Attended',
      to: 'Opportunities',
      countFrom: metrics.meetings_attended,
      countTo: metrics.opportunities_created,
      benchmarkKey: 'meeting_to_opp',
    },
    {
      funnel: 'Pipeline',
      from: 'Proposals Sent',
      to: 'Opportunities',
      countFrom: metrics.proposals_sent,
      countTo: metrics.opportunities_created,
      benchmarkKey: 'proposal_to_opp',
    },
  ];

  const FUNNEL_COLORS: Record<string, string> = {
    Call: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Email: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Meeting: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Pipeline: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          All Conversion Rates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2.5 px-3 font-medium">Funnel</th>
                <th className="text-left py-2.5 px-3 font-medium">From</th>
                <th className="text-left py-2.5 px-3 font-medium">To</th>
                <th className="text-right py-2.5 px-3 font-medium">From Count</th>
                <th className="text-right py-2.5 px-3 font-medium">To Count</th>
                <th className="text-right py-2.5 px-3 font-medium">Rate</th>
                <th className="text-right py-2.5 px-3 font-medium">Benchmark</th>
                <th className="text-center py-2.5 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rate = calcPct(row.countTo, row.countFrom);
                const bench = BENCHMARKS[row.benchmarkKey];
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary" className={`text-xs ${FUNNEL_COLORS[row.funnel] ?? ''}`}>
                        {row.funnel}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{row.from}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{row.to}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium">{row.countFrom.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium">{row.countTo.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold">{fmtPct(rate)}</td>
                    <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                      {bench ? `${bench.avg}% avg / ${bench.good}% good` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {bench && (
                        <Badge
                          variant="secondary"
                          className={`text-xs ${rateColor(rate, row.benchmarkKey)}`}
                        >
                          {rate >= bench.good ? 'Above' : rate >= bench.avg ? 'Average' : 'Below'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityReportView({ data, projectSlug, dateRange, userId }: ActivityReportViewProps) {
  const [metrics, setMetrics] = React.useState<ActivityConversionMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchConversions() {
      setMetricsLoading(true);
      try {
        const params = new URLSearchParams();
        if (dateRange) {
          params.set('start_date', dateRange.from.toISOString());
          params.set('end_date', dateRange.to.toISOString());
        }
        if (userId) params.set('user_id', userId);

        const res = await fetch(
          `/api/projects/${projectSlug}/reports/activity-conversions?${params.toString()}`
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setMetrics(json);
        }
      } catch {
        // Funnel data is supplementary; fail silently
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    }

    fetchConversions();
    return () => { cancelled = true; };
  }, [projectSlug, dateRange, userId]);

  const totalActivities =
    data.activityTiles.calls +
    data.activityTiles.emails_sent +
    data.activityTiles.quality_conversations +
    data.activityTiles.meetings_booked +
    data.activityTiles.meetings_attended;

  return (
    <div className="space-y-6">
      {/* Activity Tiles */}
      <ActivityTilesRow data={data.activityTiles} />

      {/* Conversion Funnels */}
      {metricsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading conversion funnels...</span>
          </div>
        </div>
      ) : metrics ? (
        <>
          <div>
            <h3 className="text-lg font-semibold mb-1">Conversion Funnels</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Step-by-step conversion rates compared to B2B industry benchmarks
            </p>
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
              {/* Call Funnel */}
              <ConversionFunnelCard
                title="Call Funnel"
                titleIcon={Phone}
                titleColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                steps={[
                  { label: 'Calls Made', value: metrics.calls_made, icon: Phone },
                  { label: 'Connects', value: metrics.call_connects, icon: UserCheck },
                  { label: 'Meetings Booked', value: metrics.call_meetings_booked, icon: Calendar },
                  { label: 'Meetings Attended', value: metrics.meetings_attended, icon: CheckCircle },
                  { label: 'Opportunities', value: metrics.opportunities_created, icon: Target },
                ]}
                rates={[
                  { label: 'connect rate', rate: calcPct(metrics.call_connects, metrics.calls_made), benchmarkKey: 'dial_to_connect' },
                  { label: 'meeting rate', rate: calcPct(metrics.call_meetings_booked, metrics.call_connects), benchmarkKey: 'connect_to_meeting' },
                  { label: 'show rate', rate: calcPct(metrics.meetings_attended, metrics.meetings_booked), benchmarkKey: 'meeting_show_rate' },
                  { label: 'opp rate', rate: calcPct(metrics.opportunities_created, metrics.meetings_attended), benchmarkKey: 'meeting_to_opp' },
                ]}
              />

              {/* Email Funnel */}
              <ConversionFunnelCard
                title="Email Funnel"
                titleIcon={Mail}
                titleColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                steps={[
                  { label: 'Emails Sent', value: metrics.emails_sent, icon: Mail },
                  { label: 'Opened', value: metrics.emails_opened, icon: Eye },
                  { label: 'Clicked', value: metrics.emails_clicked, icon: MousePointerClick },
                  { label: 'Replied', value: metrics.emails_replied, icon: Reply },
                ]}
                rates={[
                  { label: 'open rate', rate: calcPct(metrics.emails_opened, metrics.emails_sent), benchmarkKey: 'email_open_rate' },
                  { label: 'click rate', rate: calcPct(metrics.emails_clicked, metrics.emails_opened), benchmarkKey: 'email_click_rate' },
                  { label: 'reply rate', rate: calcPct(metrics.emails_replied, metrics.emails_sent), benchmarkKey: 'email_reply_rate' },
                ]}
              />

              {/* Meeting Funnel */}
              <ConversionFunnelCard
                title="Meeting Funnel"
                titleIcon={Calendar}
                titleColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                steps={[
                  { label: 'Meetings Booked', value: metrics.meetings_booked, icon: Calendar },
                  { label: 'Attended', value: metrics.meetings_attended, icon: CheckCircle },
                  { label: 'Deal Advanced', value: metrics.meetings_deal_advanced, icon: TrendingUp },
                  { label: 'Opportunities', value: metrics.opportunities_created, icon: Target },
                ]}
                rates={[
                  { label: 'show rate', rate: calcPct(metrics.meetings_attended, metrics.meetings_booked), benchmarkKey: 'meeting_show_rate' },
                  { label: 'advancement rate', rate: calcPct(metrics.meetings_deal_advanced, metrics.meetings_attended), benchmarkKey: 'meeting_to_opp' },
                  { label: 'opp rate', rate: calcPct(metrics.opportunities_created, metrics.meetings_deal_advanced), benchmarkKey: 'proposal_to_opp' },
                ]}
              />
            </div>
          </div>

          {/* Call Outcome Breakdown */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <MiniStat
              label="No Answer"
              value={metrics.call_no_answer}
              total={metrics.calls_made}
              icon={PhoneOff}
              color="text-muted-foreground"
            />
            <MiniStat
              label="Left Message"
              value={metrics.call_left_message}
              total={metrics.calls_made}
              icon={MessageSquare}
              color="text-blue-600 dark:text-blue-400"
            />
            <MiniStat
              label="Not Interested"
              value={metrics.not_interested}
              total={metrics.calls_made + metrics.emails_sent}
              icon={XCircle}
              color="text-red-600 dark:text-red-400"
            />
            <MiniStat
              label="Proposals Sent"
              value={metrics.proposals_sent}
              total={metrics.meetings_attended}
              icon={FileText}
              color="text-purple-600 dark:text-purple-400"
            />
            <MiniStat
              label="No Shows"
              value={metrics.meetings_no_show}
              total={metrics.meetings_booked}
              icon={XCircle}
              color="text-orange-600 dark:text-orange-400"
            />
          </div>

          {/* Full Conversion Table */}
          <ConversionSummaryTable metrics={metrics} />
        </>
      ) : null}

      {/* Email Performance + Activity Mix */}
      <div className="grid gap-6 lg:grid-cols-2">
        <EmailStatsCard data={data.email} />

        <Card>
          <CardHeader>
            <CardTitle>Activity Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ActivityBar
                label="Calls"
                count={data.activityTiles.calls}
                total={totalActivities}
                color="bg-blue-500"
                bgColor="bg-blue-500/20"
              />
              <ActivityBar
                label="Emails Sent"
                count={data.activityTiles.emails_sent}
                total={totalActivities}
                color="bg-green-500"
                bgColor="bg-green-500/20"
              />
              <ActivityBar
                label="Quality Conversations"
                count={data.activityTiles.quality_conversations}
                total={totalActivities}
                color="bg-purple-500"
                bgColor="bg-purple-500/20"
              />
              <ActivityBar
                label="Meetings Booked"
                count={data.activityTiles.meetings_booked}
                total={totalActivities}
                color="bg-orange-500"
                bgColor="bg-orange-500/20"
              />
              <ActivityBar
                label="Meetings Attended"
                count={data.activityTiles.meetings_attended}
                total={totalActivities}
                color="bg-emerald-500"
                bgColor="bg-emerald-500/20"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  total,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  total: number;
  icon: React.ElementType;
  color: string;
}) {
  const rate = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1 tabular-nums">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{rate}% of total</p>
      </CardContent>
    </Card>
  );
}

function ActivityBar({
  label,
  count,
  total,
  color,
  bgColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
}) {
  const barPct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className={`h-2.5 rounded-full ${bgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}
