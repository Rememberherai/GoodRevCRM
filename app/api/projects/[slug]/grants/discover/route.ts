import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { searchGrantsGov, mapOpportunityToGrant } from '@/lib/community/grants-gov';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { GrantsGovSearchParams, GrantsGovOpportunity } from '@/lib/community/grants-gov';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET: Search Grants.gov for federal opportunities
 * Query params: q, agencies, fundingCategories, eligibilities, oppStatuses, rows
 */
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
    const params: GrantsGovSearchParams = {
      keyword: searchParams.get('q') ?? undefined,
      agencies: searchParams.get('agencies') ?? undefined,
      fundingCategories: searchParams.get('fundingCategories') ?? undefined,
      eligibilities: searchParams.get('eligibilities') ?? undefined,
      oppStatuses: searchParams.get('oppStatuses') ?? undefined,
      rows: parseInt(searchParams.get('rows') ?? '25', 10),
    };

    if (!params.keyword) {
      return NextResponse.json({ error: 'Search keyword (q) is required' }, { status: 400 });
    }

    const result = await searchGrantsGov(params);

    return NextResponse.json({
      hitCount: result.hitCount,
      opportunities: result.opportunities,
    });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants/discover:', error);
    return NextResponse.json({ error: 'Failed to search Grants.gov' }, { status: 500 });
  }
}

/**
 * POST: Import a Grants.gov opportunity as a new grant in the pipeline
 * Body: { opportunity: GrantsGovOpportunity }
 */
export async function POST(request: Request, context: RouteContext) {
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

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'create');

    const body = await request.json() as { opportunity?: GrantsGovOpportunity };
    if (!body.opportunity?.title || !body.opportunity?.number) {
      return NextResponse.json({ error: 'Opportunity data is required' }, { status: 400 });
    }

    const grantData = mapOpportunityToGrant(body.opportunity);

    // Check for duplicate import
    const { data: existing } = await supabase
      .from('grants')
      .select('id, name')
      .eq('project_id', project.id)
      .eq('funder_grant_id', grantData.funder_grant_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: `This opportunity has already been imported as "${existing.name}"`, existing_grant_id: existing.id },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('grants')
      .insert({
        ...grantData,
        project_id: project.id,
        is_discovered: true,
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create grant');

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'grant.created' as never,
      entityType: 'grant' as never,
      entityId: data.id,
      data: data as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ grant: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/grants/discover:', error);
    return NextResponse.json({ error: 'Failed to import opportunity' }, { status: 500 });
  }
}
