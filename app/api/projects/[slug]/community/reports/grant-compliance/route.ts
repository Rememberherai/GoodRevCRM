import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grant_id');

    // If a specific grant_id is provided, return compliance for that grant
    // Otherwise return compliance summary for all awarded grants
    let grantsQuery = supabase
      .from('grants')
      .select('id, name, amount_awarded, amount_requested, status, funder_organization_id')
      .eq('project_id', project.id);

    if (grantId) {
      grantsQuery = grantsQuery.eq('id', grantId);
    } else {
      grantsQuery = grantsQuery.eq('status', 'awarded');
    }

    const { data: grants, error: grantsError } = await grantsQuery;
    if (grantsError) throw grantsError;

    if (!grants || grants.length === 0) {
      return NextResponse.json({ compliance: [] });
    }

    const grantIds = grants.map((g) => g.id);

    // Get contributions linked to these grants
    const { data: contributions } = await supabase
      .from('contributions')
      .select('id, grant_id, value, type, date')
      .eq('project_id', project.id)
      .in('grant_id', grantIds);

    // Get program enrollments for unduplicated participant count
    const { data: enrollments } = await supabase
      .from('program_enrollments')
      .select('person_id, household_id, program_id')
      .eq('status', 'active')
      .in('program_id', (
        await supabase.from('programs').select('id').eq('project_id', project.id)
      ).data?.map((p) => p.id) ?? []);

    // Get volunteer hours from contributions
    const { data: volunteerContribs } = await supabase
      .from('contributions')
      .select('hours, program_id')
      .eq('project_id', project.id)
      .eq('type', 'volunteer_hours');

    // Get attendance hours
    const { data: attendance } = await supabase
      .from('program_attendance')
      .select('hours, person_id, program_id')
      .in('program_id', (
        await supabase.from('programs').select('id').eq('project_id', project.id)
      ).data?.map((p) => p.id) ?? []);

    // Build compliance report per grant
    const compliance = grants.map((grant) => {
      const grantContribs = (contributions ?? []).filter((c) => c.grant_id === grant.id);
      const totalSpend = grantContribs.reduce((sum, c) => sum + (c.value ?? 0), 0);

      // Unduplicated participants across all project programs
      const uniquePersonIds = new Set(
        (enrollments ?? []).filter((e) => e.person_id).map((e) => e.person_id),
      );
      const uniqueHouseholdIds = new Set(
        (enrollments ?? []).filter((e) => e.household_id && !e.person_id).map((e) => e.household_id),
      );

      // Total hours delivered (volunteer + attendance)
      const volunteerHours = (volunteerContribs ?? []).reduce(
        (sum, c) => sum + (c.hours ?? 0), 0,
      );
      const attendanceHours = (attendance ?? []).reduce(
        (sum, a) => sum + (a.hours ?? 0), 0,
      );

      return {
        grant_id: grant.id,
        grant_name: grant.name,
        status: grant.status,
        amount_awarded: grant.amount_awarded,
        amount_requested: grant.amount_requested,
        total_spend: totalSpend,
        remaining_budget: (grant.amount_awarded ?? 0) - totalSpend,
        budget_utilization_pct: grant.amount_awarded
          ? Math.round((totalSpend / grant.amount_awarded) * 10000) / 100
          : 0,
        unduplicated_participants: uniquePersonIds.size + uniqueHouseholdIds.size,
        total_hours_delivered: Math.round((volunteerHours + attendanceHours) * 100) / 100,
        contribution_count: grantContribs.length,
      };
    });

    return NextResponse.json({ compliance });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/community/reports/grant-compliance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
