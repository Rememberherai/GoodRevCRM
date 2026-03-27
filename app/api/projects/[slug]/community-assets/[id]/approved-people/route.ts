import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAssetAccessManage } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { grantPersonApprovalSchema } from '@/lib/validators/asset-access';

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

    const nowIso = new Date().toISOString();

    const { data: approvals, error } = await supabase
      .from('community_asset_person_approvals')
      .select('id, asset_id, person_id, status, notes, expires_at, created_by, created_at, person:people(id, first_name, last_name, email)')
      .eq('asset_id', id)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching person approvals:', error);
      return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
    }

    return NextResponse.json({ approvals });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/community-assets/[id]/approved-people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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
    const validation = grantPersonApprovalSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Check the person belongs to this project
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', validation.data.person_id)
      .eq('project_id', project.id)
      .single();

    if (!person) {
      return NextResponse.json({ error: 'Person not found in this project' }, { status: 404 });
    }

    const { data: approval, error } = await supabase
      .from('community_asset_person_approvals')
      .upsert(
        {
          project_id: project.id,
          asset_id: id,
          person_id: validation.data.person_id,
          status: 'active',
          notes: validation.data.notes ?? null,
          expires_at: validation.data.expires_at ?? null,
          created_by: user.id,
          revoked_by: null,
          revoked_at: null,
        },
        { onConflict: 'asset_id,person_id' }
      )
      .select('id, asset_id, person_id, status, notes, expires_at, created_by, created_at')
      .single();

    if (error || !approval) {
      console.error('Error creating person approval:', error);
      return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 });
    }

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/community-assets/[id]/approved-people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
