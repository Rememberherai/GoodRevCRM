import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createGrantSchema } from '@/lib/validators/community/grants';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type GrantInsert = Database['public']['Tables']['grants']['Insert'];

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
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const status = searchParams.get('status');
    const funderId = searchParams.get('funder_organization_id');
    const assignedTo = searchParams.get('assigned_to');
    const discovered = searchParams.get('discovered');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('grants')
      .select(`
        *,
        funder:organizations!grants_funder_organization_id_fkey(id, name),
        contact:people!grants_contact_person_id_fkey(id, first_name, last_name)
      `, { count: 'exact' })
      .eq('project_id', project.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by discovered status: 'true' = only discovered, 'false' = only pipeline, omitted = all
    if (discovered === 'true') query = query.eq('is_discovered', true);
    else if (discovered === 'false') query = query.eq('is_discovered', false);

    if (status) query = query.eq('status', status);
    if (funderId) query = query.eq('funder_organization_id', funderId);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      grants: data ?? [],
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const body = await request.json();
    const validation = createGrantSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const insertData: GrantInsert = {
      ...validation.data,
      project_id: project.id,
    };

    const { data, error } = await supabase
      .from('grants')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create grant');

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'grant' as never,
      entityId: data.id,
      data: data as unknown as Record<string, unknown>,
    });
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
    console.error('Error in POST /api/projects/[slug]/grants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
