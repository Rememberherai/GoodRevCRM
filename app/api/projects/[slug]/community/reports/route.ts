import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import {
  getProgramPerformanceReport,
  getContributionSummaryReport,
  getHouseholdDemographicsReport,
  getVolunteerImpactReport,
  getUnduplicatedParticipantCount,
  getContractorHoursReport,
  getGrantPipelineReport,
  getEngagementTrendsReport,
  getRiskReferralReport,
  getEventOverviewReport,
  getIndividualEventReport,
  getSeriesReport,
  type DateRangeFilter,
} from '@/lib/community/reports';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/community/reports?type=...&from=...&to=...
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.project_type !== 'community') {
      return NextResponse.json({ error: 'Not a community project' }, { status: 400 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'reports', 'view');

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') ?? 'all';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const dateRange: DateRangeFilter | undefined = from && to ? { from, to } : undefined;

    const result: Record<string, unknown> = {};

    if (reportType === 'all' || reportType === 'program_performance') {
      result.program_performance = await getProgramPerformanceReport(supabase, project.id, dateRange);
    }

    if (reportType === 'all' || reportType === 'contribution_summary') {
      result.contribution_summary = await getContributionSummaryReport(supabase, project.id, dateRange);
    }

    if (reportType === 'all' || reportType === 'household_demographics') {
      result.household_demographics = await getHouseholdDemographicsReport(supabase, project.id, dateRange);
    }

    if (reportType === 'all' || reportType === 'volunteer_impact') {
      result.volunteer_impact = await getVolunteerImpactReport(supabase, project.id, 33.49, dateRange);
    }

    if (reportType === 'all' || reportType === 'contractor_hours') {
      result.contractor_hours = await getContractorHoursReport(supabase, project.id, dateRange);
    }

    if (reportType === 'all') {
      result.unduplicated_participants = await getUnduplicatedParticipantCount(supabase, project.id, dateRange);
    }

    if (reportType === 'all' || reportType === 'grant_pipeline') {
      result.grant_pipeline = await getGrantPipelineReport(supabase, project.id, dateRange);
    }

    if (reportType === 'all' || reportType === 'engagement_trends') {
      result.engagement_trends = await getEngagementTrendsReport(supabase, project.id, dateRange);
    }

    if (reportType === 'all' || reportType === 'risk_referral') {
      result.risk_referral = await getRiskReferralReport(supabase, project.id);
    }

    if (reportType === 'all' || reportType === 'event_overview') {
      result.event_overview = await getEventOverviewReport(supabase, project.id, dateRange);
    }

    if (reportType === 'event_detail') {
      const eventId = searchParams.get('eventId');
      if (eventId) {
        result.event_detail = await getIndividualEventReport(supabase, project.id, eventId);
      }
    }

    if (reportType === 'series_report') {
      const seriesId = searchParams.get('seriesId');
      if (seriesId) {
        result.series_report = await getSeriesReport(supabase, project.id, seriesId);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error in GET /api/projects/[slug]/community/reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
