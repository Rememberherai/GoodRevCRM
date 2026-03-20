import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { updateContributionSchema } from '@/lib/validators/community/contributions';
import type { Database } from '@/types/database';

type ContributionUpdate = Database['public']['Tables']['contributions']['Update'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const { data: contribution, error } = await supabase
      .from('contributions')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !contribution) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    }

    return NextResponse.json({ contribution });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/contributions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'contributions', 'update');

    const body = await request.json();
    const validation = updateContributionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { project_id: _projectId, ...validatedUpdates } = validation.data;
    const updateData: ContributionUpdate = { ...validatedUpdates };
    const { data: contribution, error } = await supabase
      .from('contributions')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !contribution) {
      console.error('Error updating contribution:', error);
      return NextResponse.json({ error: 'Failed to update contribution' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'contribution',
      entityId: id,
      data: contribution as Record<string, unknown>,
      previousData: validation.data as Record<string, unknown>,
    });

    return NextResponse.json({ contribution });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/contributions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'contributions', 'delete');

    const { error } = await supabase
      .from('contributions')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id)
      .select('id')
      .single();

    if (error) {
      console.error('Error deleting contribution:', error);
      return NextResponse.json({ error: 'Failed to delete contribution' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'contribution',
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/contributions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
