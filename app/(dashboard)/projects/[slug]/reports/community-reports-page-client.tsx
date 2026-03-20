'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, HandCoins, Home, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgramPerformanceReportView } from '@/components/community/reports/program-performance';
import { ContributionSummaryReportView } from '@/components/community/reports/contribution-summary';
import { HouseholdDemographicsReportView } from '@/components/community/reports/household-demographics';
import { VolunteerImpactReportView } from '@/components/community/reports/volunteer-impact';
import { ContractorHoursReportView } from '@/components/community/reports/contractor-hours';

interface ProgramPerformanceReport {
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
}

interface ContributionSummaryReport {
  by_type: { type: string; count: number; total_value: number; total_hours: number }[];
  by_dimension: { dimension_id: string; dimension_label: string; count: number; total_value: number }[];
  by_status: { status: string; count: number; total_value: number }[];
}

interface HouseholdDemographicsReport {
  total_households: number;
  total_members: number;
  avg_household_size: number;
  by_city: { city: string; count: number }[];
}

interface VolunteerImpactReport {
  total_volunteers: number;
  total_hours: number;
  estimated_value: number;
  by_program: { program_id: string; program_name: string; hours: number; volunteers: number }[];
}

interface CommunityReportsResponse {
  program_performance?: ProgramPerformanceReport[];
  contribution_summary?: ContributionSummaryReport;
  household_demographics?: HouseholdDemographicsReport;
  volunteer_impact?: VolunteerImpactReport;
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
}

export function CommunityReportsPageClient({ projectSlug }: { projectSlug: string }) {
  const [data, setData] = useState<CommunityReportsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectSlug}/community/reports?type=all`);
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
  }, [projectSlug]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Community Reporting</h2>
          <p className="text-sm text-muted-foreground">
            Funder-facing summaries for programs, households, contributions, and volunteer impact.
          </p>
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
          <div className="grid gap-4 md:grid-cols-4">
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
                <CardTitle className="text-sm">Volunteer Hours</CardTitle>
                <CardDescription>Logged service and volunteer time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <HandCoins className="h-5 w-5 text-muted-foreground" />
                  {Number(data.volunteer_impact?.total_hours ?? 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="programs">
            <TabsList>
              <TabsTrigger value="programs">Programs</TabsTrigger>
              <TabsTrigger value="contributions">Contributions</TabsTrigger>
              <TabsTrigger value="households">Households</TabsTrigger>
              <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
              <TabsTrigger value="contractors">Contractors</TabsTrigger>
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
          </Tabs>
        </>
      )}
    </div>
  );
}
