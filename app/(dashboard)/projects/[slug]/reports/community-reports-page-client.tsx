'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  BarChart3,
  CalendarDays,
  Download,
  HandCoins,
  Home,
  Loader2,
  Printer,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import { ProgramPerformanceReportView } from '@/components/community/reports/program-performance';
import { ContributionSummaryReportView } from '@/components/community/reports/contribution-summary';
import { HouseholdDemographicsReportView } from '@/components/community/reports/household-demographics';
import { VolunteerImpactReportView } from '@/components/community/reports/volunteer-impact';
import { ContractorHoursReportView } from '@/components/community/reports/contractor-hours';
import { GrantsOverviewReportView } from '@/components/community/reports/grants-overview';
import { EngagementTrendsReportView } from '@/components/community/reports/engagement-trends';
import { RiskReferralsReportView } from '@/components/community/reports/risk-referrals';
import { EventOverviewReportView } from '@/components/community/reports/event-overview';
import { EventDetailReportView } from '@/components/community/reports/event-detail-report';
import type { EventOverviewReport, IndividualEventReport } from '@/lib/community/reports';
import type { DateRange } from '@/types/analytics';

interface CommunityReportsResponse {
  program_performance?: {
    program_id: string;
    program_name: string;
    status: string;
    total_enrolled: number;
    active_enrolled: number;
    completed: number;
    withdrawn: number;
    total_attendance_records: number;
    total_hours: number;
    unique_participants: number;
  }[];
  contribution_summary?: {
    by_type: { type: string; count: number; total_value: number; total_hours: number }[];
    by_dimension: { dimension_id: string; dimension_label: string; count: number; total_value: number }[];
    by_status: { status: string; count: number; total_value: number }[];
  };
  household_demographics?: {
    total_households: number;
    total_members: number;
    avg_household_size: number;
    by_city: { city: string; count: number }[];
  };
  volunteer_impact?: {
    total_volunteers: number;
    total_hours: number;
    estimated_value: number;
    by_program: { program_id: string; program_name: string; hours: number; volunteers: number }[];
  };
  contractor_hours?: {
    total_contractors: number;
    total_hours: number;
    by_contractor: {
      contractor_id: string;
      contractor_name: string;
      hours: number;
      jobs: number;
      out_of_scope_jobs: number;
    }[];
  };
  unduplicated_participants?: number;
  grant_pipeline?: {
    by_status: { status: string; count: number; total_amount: number }[];
    compliance: {
      grant_id: string;
      grant_name: string;
      status: string;
      amount_awarded: number | null;
      total_spend: number;
      budget_utilization_pct: number;
    }[];
  };
  engagement_trends?: {
    monthly_attendance: { month: string; count: number; hours: number }[];
    monthly_households: { month: string; count: number }[];
    monthly_contributions: { month: string; type: string; value: number; count: number }[];
  };
  risk_referral?: {
    risk_tiers: { tier: string; count: number }[];
    risk_factors: { factor: string; count: number }[];
    referrals_by_status: { status: string; count: number }[];
    referrals_by_service: { service_type: string; count: number }[];
  };
  event_overview?: EventOverviewReport;
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CommunityReportsPageClient({ projectSlug }: { projectSlug: string }) {
  const [data, setData] = useState<CommunityReportsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [activeTab, setActiveTab] = useState('programs');
  const [eventDrillDownId, setEventDrillDownId] = useState<string | null>(null);
  const [eventDetailData, setEventDetailData] = useState<IndividualEventReport | null>(null);
  const [eventDetailLoading, setEventDetailLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEventDrillDownId(null);
    setEventDetailData(null);

    try {
      let url = `/api/projects/${projectSlug}/community/reports?type=all`;
      if (dateRange) {
        url += `&from=${format(dateRange.from, 'yyyy-MM-dd')}&to=${format(dateRange.to, 'yyyy-MM-dd')}`;
      }
      const response = await fetch(url);
      const json = await response.json() as CommunityReportsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? 'Failed to load community reports');
      }

      setData(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load community reports');
    } finally {
      setIsLoading(false);
    }
  }, [projectSlug, dateRange]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const loadEventDetail = useCallback(async (eventId: string) => {
    setEventDetailLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/community/reports?type=event_detail&eventId=${eventId}`);
      const json = await response.json() as { event_detail?: IndividualEventReport };
      setEventDetailData(json.event_detail ?? null);
    } catch {
      setEventDetailData(null);
    } finally {
      setEventDetailLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    if (eventDrillDownId) {
      void loadEventDetail(eventDrillDownId);
    }
  }, [eventDrillDownId, loadEventDetail]);

  function handleExportCSV() {
    if (!data) return;

    if (activeTab === 'programs' && data.program_performance) {
      downloadCSV('program-performance.csv',
        ['Program', 'Status', 'Enrolled', 'Active', 'Completed', 'Withdrawn', 'Attendance Records', 'Hours', 'Unique Participants'],
        data.program_performance.map((p) => [
          p.program_name, p.status, String(p.total_enrolled), String(p.active_enrolled),
          String(p.completed), String(p.withdrawn), String(p.total_attendance_records),
          p.total_hours.toFixed(1), String(p.unique_participants),
        ])
      );
    } else if (activeTab === 'contributions' && data.contribution_summary) {
      const rows = data.contribution_summary.by_type.map((r) => [
        r.type, String(r.count), r.total_value.toFixed(2), r.total_hours.toFixed(1),
      ]);
      downloadCSV('contributions.csv', ['Type', 'Count', 'Value', 'Hours'], rows);
    } else if (activeTab === 'households' && data.household_demographics) {
      const rows = data.household_demographics.by_city.map((r) => [r.city, String(r.count)]);
      downloadCSV('households.csv', ['City', 'Count'], rows);
    } else if (activeTab === 'volunteers' && data.volunteer_impact) {
      const rows = data.volunteer_impact.by_program.map((r) => [
        r.program_name, r.hours.toFixed(1), String(r.volunteers),
      ]);
      downloadCSV('volunteer-impact.csv', ['Program', 'Hours', 'Workers'], rows);
    } else if (activeTab === 'contractors' && data.contractor_hours) {
      const rows = data.contractor_hours.by_contractor.map((r) => [
        r.contractor_name, r.hours.toFixed(1), String(r.jobs), String(r.out_of_scope_jobs),
      ]);
      downloadCSV('contractor-hours.csv', ['Contractor', 'Hours', 'Jobs', 'Out of Scope'], rows);
    } else if (activeTab === 'grants' && data.grant_pipeline) {
      const rows = data.grant_pipeline.by_status.map((r) => [
        r.status, String(r.count), r.total_amount.toFixed(2),
      ]);
      downloadCSV('grants.csv', ['Status', 'Count', 'Amount'], rows);
    } else if (activeTab === 'events' && data.event_overview) {
      const rows = data.event_overview.top_events_by_attendance.map((r) => [
        r.title, r.starts_at ?? '', String(r.registrations), String(r.checked_in),
        String(r.attendance_rate), r.capacity_utilization !== null ? String(r.capacity_utilization) : '',
      ]);
      downloadCSV('events.csv', ['Event', 'Date', 'Registrations', 'Checked In', 'Attendance %', 'Capacity %'], rows);
    }
  }

  const totalContribValue = (data?.contribution_summary?.by_type ?? [])
    .reduce((sum, r) => sum + r.total_value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Community Reporting</h2>
            <p className="text-sm text-muted-foreground">
              Funder-facing summaries for programs, households, contributions, and work hours impact.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectSlug}/settings/public-dashboard`}>
              <Settings className="mr-2 h-4 w-4" />
              Configure Public Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Programs</CardTitle>
                <CardDescription>Tracked in this report set</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  {data.program_performance?.length ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Unduplicated Participants</CardTitle>
                <CardDescription>Distinct people across programs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  {Number(data.unduplicated_participants ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Households</CardTitle>
                <CardDescription>Registered community households</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <Home className="h-5 w-5 text-muted-foreground" />
                  {Number(data.household_demographics?.total_households ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Work Hours</CardTitle>
                <CardDescription>Logged service and work time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <HandCoins className="h-5 w-5 text-muted-foreground" />
                  {Number(data.volunteer_impact?.total_hours ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Contributions</CardTitle>
                <CardDescription>Total recorded value</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  {formatCurrency(totalContribValue)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Events</CardTitle>
                <CardDescription>Total events tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  {data.event_overview?.total_events ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Report Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="programs">Programs</TabsTrigger>
              <TabsTrigger value="contributions">Contributions</TabsTrigger>
              <TabsTrigger value="households">Households</TabsTrigger>
              <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
              <TabsTrigger value="contractors">Contractors</TabsTrigger>
              <TabsTrigger value="grants">Grants</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="risk">Risk & Referrals</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
            </TabsList>

            <TabsContent value="programs" className="pt-4">
              <ProgramPerformanceReportView data={data.program_performance ?? []} />
            </TabsContent>
            <TabsContent value="contributions" className="pt-4">
              <ContributionSummaryReportView data={data.contribution_summary} />
            </TabsContent>
            <TabsContent value="households" className="pt-4">
              <HouseholdDemographicsReportView data={data.household_demographics} />
            </TabsContent>
            <TabsContent value="volunteers" className="pt-4">
              <VolunteerImpactReportView data={data.volunteer_impact} />
            </TabsContent>
            <TabsContent value="contractors" className="pt-4">
              <ContractorHoursReportView data={data.contractor_hours} />
            </TabsContent>
            <TabsContent value="grants" className="pt-4">
              <GrantsOverviewReportView data={data.grant_pipeline} />
            </TabsContent>
            <TabsContent value="trends" className="pt-4">
              <EngagementTrendsReportView data={data.engagement_trends} />
            </TabsContent>
            <TabsContent value="risk" className="pt-4">
              <RiskReferralsReportView data={data.risk_referral} />
            </TabsContent>
            <TabsContent value="events" className="pt-4">
              {eventDrillDownId ? (
                eventDetailLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <EventDetailReportView
                    data={eventDetailData}
                    onBack={() => {
                      setEventDrillDownId(null);
                      setEventDetailData(null);
                    }}
                  />
                )
              ) : (
                <EventOverviewReportView
                  data={data.event_overview}
                  onDrillDown={(eventId) => setEventDrillDownId(eventId)}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
