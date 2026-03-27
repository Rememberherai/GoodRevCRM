import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';

interface RouteContext {
  params: Promise<{ slug: string; id: string; userId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, userId } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id, project_type')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project || project.project_type !== 'community') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const actorRole = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (actorRole !== 'owner' && actorRole !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can manage approvers' }, { status: 403 });
    }

    // Verify asset belongs to this project
    const { data: asset } = await supabase
      .from('community_assets')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const { data: deletedApprovers, error } = await supabase
      .from('community_asset_approvers')
      .delete()
      .eq('asset_id', id)
      .eq('user_id', userId)
      .select('id');

    if (error) throw error;
    if (!deletedApprovers || deletedApprovers.length === 0) {
      return NextResponse.json({ error: 'Approver not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/community-assets/[id]/approvers/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
