import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateReferralSchema } from '@/lib/validators/community/referrals';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

type ReferralUpdate = Database['public']['Tables']['referrals']['Update'];

async function getProjectId(slug: string) {
  const supabase = await createClient();
  const { data: project } = await supabase.from('projects').select('id, project_type').eq('slug', slug).is('deleted_at', null).single();
  return { supabase, project };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectId(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'view');

    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        person:people(id, first_name, last_name),
        household:households(id, name),
        partner:organizations(id, name)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    return NextResponse.json({ referral: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/referrals/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectId(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'update');

    const body = await request.json();
    const validation = updateReferralSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const updateData = Object.fromEntries(
      Object.entries(validation.data).filter(([key]) => key !== 'project_id')
    ) as ReferralUpdate;

    const { data, error } = await supabase
      .from('referrals')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'person',
      entityId: data.person_id ?? data.household_id ?? data.id,
      data: { referral_id: data.id, status: data.status, service_type: data.service_type },
      metadata: { community_trigger: data.status === 'completed' ? 'referral.completed' : 'referral.updated' },
    });

    return NextResponse.json({ referral: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/referrals/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const { supabase, project } = await getProjectId(slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!project || project.project_type !== 'community') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireCommunityPermission(supabase, user.id, project.id, 'referrals', 'delete');

    const { error } = await supabase.from('referrals').delete().eq('id', id).eq('project_id', project.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/referrals/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
