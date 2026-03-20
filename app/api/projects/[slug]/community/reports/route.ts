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
} from '@/lib/community/reports';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/community/reports?type=program_performance|contribution_summary|household_demographics|volunteer_impact|all
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

    const result: Record<string, unknown> = {};

    if (reportType === 'all' || reportType === 'program_performance') {
      result.program_performance = await getProgramPerformanceReport(supabase, project.id);
    }

    if (reportType === 'all' || reportType === 'contribution_summary') {
      result.contribution_summary = await getContributionSummaryReport(supabase, project.id);
    }

    if (reportType === 'all' || reportType === 'household_demographics') {
      result.household_demographics = await getHouseholdDemographicsReport(supabase, project.id);
    }

    if (reportType === 'all' || reportType === 'volunteer_impact') {
      result.volunteer_impact = await getVolunteerImpactReport(supabase, project.id);
    }

    if (reportType === 'all' || reportType === 'contractor_hours') {
      result.contractor_hours = await getContractorHoursReport(supabase, project.id);
    }

    if (reportType === 'all') {
      result.unduplicated_participants = await getUnduplicatedParticipantCount(supabase, project.id);
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
