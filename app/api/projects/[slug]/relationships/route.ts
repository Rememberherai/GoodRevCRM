import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { createRelationshipSchema } from '@/lib/validators/community/relationships';
import { buildInfluencerScores } from '@/lib/community/social-network';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'view');

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('person_id');

    let query = supabase
      .from('relationships')
      .select(`
        *,
        person_a:people!relationships_person_a_id_fkey(id, first_name, last_name),
        person_b:people!relationships_person_b_id_fkey(id, first_name, last_name)
      `)
      .eq('project_id', project.id)
      .order('updated_at', { ascending: false });

    if (personId) {
      query = query.or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const influencerScores = buildInfluencerScores((data ?? []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      notes: row.notes,
      person_a_id: row.person_a_id,
      person_b_id: row.person_b_id,
      project_id: row.project_id,
      type: row.type,
    })));

    return NextResponse.json({ relationships: data ?? [], influencerScores });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'create');

    const body = await request.json();
    const validation = createRelationshipSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('relationships')
      .insert({ ...validation.data, project_id: project.id })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create relationship');
    emitAutomationEvent({ projectId: project.id, triggerType: 'entity.created', entityType: 'relationship', entityId: data.id, data: data as unknown as Record<string, unknown> });
    return NextResponse.json({ relationship: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in POST /api/projects/[slug]/relationships:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
