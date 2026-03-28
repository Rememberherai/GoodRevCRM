import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, id: personId } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'view');

    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', personId)
      .eq('project_id', project.id)
      .maybeSingle();

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    const { data: approvals, error } = await supabase
      .from('community_asset_person_approvals')
      .select(`
        id,
        person_id,
        status,
        notes,
        expires_at,
        created_at,
        asset:community_assets!inner(
          id,
          name,
          access_enabled
        )
      `)
      .eq('project_id', project.id)
      .eq('person_id', personId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      approvals: (approvals ?? []).filter((approval) => approval.asset?.access_enabled),
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/people/[id]/approved-for:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/people/[id]/approved-for — grant asset access
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id: personId } = await context.params;
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

    await requireCommunityPermission(supabase, user.id, project.id, 'asset_access', 'manage');

    const body = await request.json();
    const { asset_id, notes, expires_at } = body as {
      asset_id: string;
      notes?: string;
      expires_at?: string;
    };

    if (!asset_id) {
      return NextResponse.json({ error: 'asset_id is required' }, { status: 400 });
    }

    // Verify person and asset belong to this project
    const [{ data: person }, { data: asset }] = await Promise.all([
      supabase.from('people').select('id').eq('id', personId).eq('project_id', project.id).maybeSingle(),
      supabase.from('community_assets').select('id, name').eq('id', asset_id).eq('project_id', project.id).maybeSingle(),
    ]);

    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const { data: approval, error } = await supabase
      .from('community_asset_person_approvals')
      .upsert(
        {
          project_id: project.id,
          asset_id,
          person_id: personId,
          status: 'active',
          notes: notes || null,
          expires_at: expires_at || null,
          created_by: user.id,
          revoked_by: null,
          revoked_at: null,
        },
        { onConflict: 'asset_id,person_id' }
      )
      .select(`
        id,
        person_id,
        status,
        notes,
        expires_at,
        created_at,
        asset:community_assets!inner(id, name, access_enabled)
      `)
      .single();

    if (error) {
      console.error('Error creating asset approval:', error);
      return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'person',
      entityId: personId,
      data: { approval_id: approval.id, asset_id, action: 'asset_approved' },
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/people/[id]/approved-for:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
