import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createContributionSchema } from '@/lib/validators/community/contributions';
import type { Database } from '@/types/database';

type ContributionInsert = Database['public']['Tables']['contributions']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'contributions', 'view');

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const type = searchParams.get('type');
    const dimensionId = searchParams.get('dimensionId');
    const programId = searchParams.get('programId');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('contributions')
      .select(`
        *,
        dimension:impact_dimensions(id, label, color),
        donor_person:people(id, first_name, last_name),
        donor_organization:organizations(id, name),
        donor_household:households(id, name),
        program:programs(id, name)
      `, { count: 'exact' })
      .eq('project_id', project.id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq('type', type);
    if (dimensionId) query = query.eq('dimension_id', dimensionId);
    if (programId) query = query.eq('program_id', programId);

    const { data: contributions, error, count } = await query;
    if (error) {
      console.error('Error fetching contributions:', error);
      return NextResponse.json({ error: 'Failed to fetch contributions' }, { status: 500 });
    }

    return NextResponse.json({
      contributions: contributions ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/contributions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'contributions', 'create');

    const body = await request.json();
    const validation = createContributionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    let dimensionId = validation.data.dimension_id ?? null;
    if (!dimensionId && validation.data.program_id) {
      const { data: program } = await supabase
        .from('programs')
        .select('target_dimensions')
        .eq('id', validation.data.program_id)
        .eq('project_id', project.id)
        .single();
      dimensionId = Array.isArray(program?.target_dimensions) && program.target_dimensions.length > 0
        ? program.target_dimensions[0] ?? null
        : null;
    }

    const insertData: ContributionInsert = {
      ...validation.data,
      project_id: project.id,
      dimension_id: dimensionId,
    };

    const { data: contribution, error } = await supabase
      .from('contributions')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating contribution:', error);
      return NextResponse.json({ error: 'Failed to create contribution' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'contribution',
      entityId: contribution.id,
      data: contribution as Record<string, unknown>,
    });

    return NextResponse.json({ contribution }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/contributions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
