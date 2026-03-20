import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { updateCommunityAssetSchema } from '@/lib/validators/community/assets';
import type { Database } from '@/types/database';

type CommunityAssetUpdate = Database['public']['Tables']['community_assets']['Update'];

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

    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'view');

    const { data: asset, error } = await supabase
      .from('community_assets')
      .select(`
        *,
        dimension:impact_dimensions(id, label, color),
        steward_person:people(id, first_name, last_name, email),
        steward_organization:organizations(id, name)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !asset) {
      return NextResponse.json({ error: 'Community asset not found' }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/[id]:', error);
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

    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'update');

    const body = await request.json();
    const validation = updateCommunityAssetSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { project_id: _projectId, ...validatedUpdates } = validation.data;
    const updateData: CommunityAssetUpdate = { ...validatedUpdates };
    const { data: asset, error } = await supabase
      .from('community_assets')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !asset) {
      console.error('Error updating community asset:', error);
      return NextResponse.json({ error: 'Failed to update community asset' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'community_asset',
      entityId: id,
      data: asset as Record<string, unknown>,
      previousData: validation.data as Record<string, unknown>,
    });

    return NextResponse.json({ asset });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/community-assets/[id]:', error);
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

    await requireCommunityPermission(supabase, user.id, project.id, 'community_assets', 'delete');

    const { error } = await supabase
      .from('community_assets')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id)
      .select('id')
      .single();

    if (error) {
      console.error('Error deleting community asset:', error);
      return NextResponse.json({ error: 'Failed to delete community asset' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'community_asset',
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/community-assets/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
