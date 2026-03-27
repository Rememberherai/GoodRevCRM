import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { addApproverSchema } from '@/lib/validators/asset-access';
import type { ProjectRole } from '@/types/user';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const role = await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');
    if (role !== 'owner' && role !== 'admin') {
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

    const { data: approvers, error } = await supabase
      .from('community_asset_approvers')
      .select('id, user_id, created_at, user:users(id, display_name, email)')
      .eq('asset_id', id);

    if (error) throw error;

    return NextResponse.json({ approvers: approvers ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/[id]/approvers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    const body = await request.json();
    const validation = addApproverSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { data: asset } = await supabase
      .from('community_assets')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', validation.data.user_id)
      .maybeSingle();

    const allowedRoles: ProjectRole[] = ['owner', 'admin', 'staff'];
    if (!membership || !allowedRoles.includes(membership.role as ProjectRole)) {
      return NextResponse.json(
        { error: 'Approver must be an owner, admin, or staff member on this project' },
        { status: 400 }
      );
    }

    const { data: approver, error } = await supabase
      .from('community_asset_approvers')
      .insert({ asset_id: id, user_id: validation.data.user_id, project_id: project.id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'User is already an approver for this asset' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ approver }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community-assets/[id]/approvers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
