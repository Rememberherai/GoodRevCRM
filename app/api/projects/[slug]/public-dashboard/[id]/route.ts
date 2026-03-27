import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateDashboardConfigSchema } from '@/lib/validators/community/public-dashboard';
import { getPublicDashboardAggregateData, serializePublicDashboardPreviewData } from '@/lib/community/public-dashboard-queries';
import { hashPublicDashboardPassword } from '@/lib/community/public-dashboard-auth';
import type { Json } from '@/types/database';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

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
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');

    const { data, error } = await supabase.from('public_dashboard_configs').select('*').eq('id', id).eq('project_id', project.id).single();
    if (error || !data) return NextResponse.json({ error: 'Public dashboard config not found' }, { status: 404 });
    return NextResponse.json({ config: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/public-dashboard/[id]:', error);
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
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');

    const body = await request.json();
    const validation = updateDashboardConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...validation.data };
    if (validation.data.password) {
      updateData.password_hash = hashPublicDashboardPassword(validation.data.password);
    }
    delete updateData.password;

    const currentConfigResult = await supabase.from('public_dashboard_configs').select('*').eq('id', id).eq('project_id', project.id).single();
    if (!currentConfigResult.data) {
      return NextResponse.json({ error: 'Public dashboard config not found' }, { status: 404 });
    }

    const mergedConfig = {
      ...currentConfigResult.data,
      ...updateData,
      ...(updateData.theme ? { theme: updateData.theme as Json } : {}),
      ...(updateData.widgets ? { widgets: updateData.widgets as Json } : {}),
    };
    // Snapshot/live lifecycle: clear stale snapshot data when switching to live
    if (mergedConfig.data_freshness === 'snapshot') {
      mergedConfig.snapshot_data = serializePublicDashboardPreviewData(await getPublicDashboardAggregateData(mergedConfig));
    } else {
      mergedConfig.snapshot_data = null;
    }

    // Publication lifecycle: published_at records first publication only
    if (mergedConfig.status === 'published' && !mergedConfig.published_at) {
      mergedConfig.published_at = new Date().toISOString();
      mergedConfig.published_by = user.id;
    }

    // Archive lifecycle: set archived_at on archive, clear on unarchive
    if (mergedConfig.status === 'archived' && !mergedConfig.archived_at) {
      mergedConfig.archived_at = new Date().toISOString();
    } else if (mergedConfig.status !== 'archived' && mergedConfig.archived_at) {
      mergedConfig.archived_at = null;
    }

    const { data, error } = await supabase
      .from('public_dashboard_configs')
      .update(mergedConfig)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to update public dashboard config');
    return NextResponse.json({ config: data });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/public-dashboard/[id]:', error);
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
    await requireCommunityPermission(supabase, user.id, project.id, 'public_dashboard', 'manage');

    const { error } = await supabase.from('public_dashboard_configs').delete().eq('id', id).eq('project_id', project.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/public-dashboard/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
