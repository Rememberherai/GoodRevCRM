import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';

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
