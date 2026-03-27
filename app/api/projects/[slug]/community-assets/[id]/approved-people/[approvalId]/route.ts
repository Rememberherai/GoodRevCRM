import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAssetAccessManage } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { updatePersonApprovalSchema } from '@/lib/validators/asset-access';

interface RouteContext {
  params: Promise<{ slug: string; id: string; approvalId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { slug, id, approvalId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    await requireAssetAccessManage(supabase, user.id, project.id, id);

    const { data: asset } = await supabase
      .from('community_assets')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updatePersonApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { data: approval, error } = await supabase
      .from('community_asset_person_approvals')
      .update(validation.data)
      .eq('id', approvalId)
      .eq('asset_id', id)
      .eq('status', 'active')
      .select()
      .single();

    if (error) {
      console.error('Error updating person approval:', error);
      return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 });
    }
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    return NextResponse.json({ approval });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in PATCH /api/projects/[slug]/community-assets/[id]/approved-people/[approvalId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { slug, id, approvalId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    await requireAssetAccessManage(supabase, user.id, project.id, id);

    const { data: asset } = await supabase
      .from('community_assets')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const { data: approvals, error } = await supabase
      .from('community_asset_person_approvals')
      .update({
        status: 'revoked',
        revoked_by: user.id,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('asset_id', id)
      .eq('status', 'active')
      .select('id');

    if (error) {
      console.error('Error revoking person approval:', error);
      return NextResponse.json({ error: 'Failed to revoke approval' }, { status: 500 });
    }
    if (!approvals || approvals.length === 0) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in DELETE /api/projects/[slug]/community-assets/[id]/approved-people/[approvalId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
