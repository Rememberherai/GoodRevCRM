import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateBroadcastSchema } from '@/lib/validators/community/broadcasts';
import { resolveBroadcastRecipients } from '@/lib/community/broadcasts';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database, Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

type BroadcastUpdate = Database['public']['Tables']['broadcasts']['Update'];

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
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'view');

    const { data, error } = await supabase.from('broadcasts').select('*').eq('id', id).eq('project_id', project.id).single();
    if (error || !data) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    const recipients = await resolveBroadcastRecipients(project.id, data.filter_criteria);
    return NextResponse.json({ broadcast: data, recipients });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/broadcasts/[id]:', error);
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
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'update');

    const body = await request.json();
    const validation = updateBroadcastSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const updateData = Object.fromEntries(
      Object.entries(validation.data).filter(([key]) => key !== 'project_id')
    ) as BroadcastUpdate;
    if (validation.data.filter_criteria !== undefined) {
      updateData.filter_criteria = validation.data.filter_criteria as unknown as Json;
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    emitAutomationEvent({ projectId: project.id, triggerType: 'entity.updated', entityType: 'broadcast', entityId: id, data: data as unknown as Record<string, unknown> });
    const recipients = await resolveBroadcastRecipients(project.id, data.filter_criteria);
    return NextResponse.json({ broadcast: data, recipient_count: recipients.length });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/broadcasts/[id]:', error);
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
    await requireCommunityPermission(supabase, user.id, project.id, 'broadcasts', 'delete');

    const { error } = await supabase.from('broadcasts').delete().eq('id', id).eq('project_id', project.id);
    if (error) throw error;
    emitAutomationEvent({ projectId: project.id, triggerType: 'entity.deleted', entityType: 'broadcast', entityId: id, data: { id, project_id: project.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/broadcasts/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
