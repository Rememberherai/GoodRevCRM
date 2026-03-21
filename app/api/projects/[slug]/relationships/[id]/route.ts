import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateRelationshipSchema } from '@/lib/validators/community/relationships';
import type { Database } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

type RelationshipUpdate = Database['public']['Tables']['relationships']['Update'];

async function getProjectContext(slug: string) {
  const supabase = await createClient();
  const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
  return { supabase, project };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectContext(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'view');

    const { data, error } = await supabase
      .from('relationships')
      .select(`
        *,
        person_a:people!relationships_person_a_id_fkey(id, first_name, last_name),
        person_b:people!relationships_person_b_id_fkey(id, first_name, last_name)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });
    return NextResponse.json({ relationship: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/relationships/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectContext(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'update');

    const body = await request.json();
    const validation = updateRelationshipSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const updateData = Object.fromEntries(
      Object.entries(validation.data).filter(([key]) => key !== 'project_id')
    ) as RelationshipUpdate;

    const { data, error } = await supabase
      .from('relationships')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });
    return NextResponse.json({ relationship: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/relationships/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectContext(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'relationships', 'delete');

    const { error } = await supabase.from('relationships').delete().eq('id', id).eq('project_id', project.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/relationships/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
