import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateContractorScopeSchema } from '@/lib/validators/community/contractors';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type ContractorScopeUpdate = Database['public']['Tables']['contractor_scopes']['Update'];

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

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'view');

    const { data: scope, error } = await supabase
      .from('contractor_scopes')
      .select('*, contractor:people!contractor_scopes_contractor_id_fkey(*), jobs(*)')
      .eq('project_id', project.id)
      .eq('id', id)
      .single();

    if (error || !scope) {
      return NextResponse.json({ error: 'Contractor scope not found' }, { status: 404 });
    }

    return NextResponse.json({ scope });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error in GET /api/projects/[slug]/contractor-scopes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'update');

    const body = await request.json();
    const validation = updateContractorScopeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const d = validation.data;
    const updateData: ContractorScopeUpdate = {};
    if (d.title !== undefined) updateData.title = d.title;
    if (d.description !== undefined) updateData.description = d.description;
    if (d.status !== undefined) updateData.status = d.status;
    if (d.start_date !== undefined) updateData.start_date = d.start_date ?? null;
    if (d.end_date !== undefined) updateData.end_date = d.end_date ?? null;
    if (d.compensation_terms !== undefined) updateData.compensation_terms = d.compensation_terms ?? null;
    if (d.service_categories !== undefined) updateData.service_categories = d.service_categories;
    if (d.certifications !== undefined) updateData.certifications = d.certifications;
    if (d.service_area_radius_miles !== undefined) updateData.service_area_radius_miles = d.service_area_radius_miles ?? null;
    if (d.home_base_latitude !== undefined) updateData.home_base_latitude = d.home_base_latitude ?? null;
    if (d.home_base_longitude !== undefined) updateData.home_base_longitude = d.home_base_longitude ?? null;
    if (d.document_url !== undefined) updateData.document_url = d.document_url === '' ? null : d.document_url;

    const { data: scope, error } = await supabase
      .from('contractor_scopes')
      .update(updateData)
      .eq('project_id', project.id)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !scope) {
      console.error('Error updating contractor scope:', error);
      return NextResponse.json({ error: 'Failed to update contractor scope' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'contractor_scope' as never,
      entityId: scope.id,
      data: scope as Record<string, unknown>,
    });

    return NextResponse.json({ scope });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error in PATCH /api/projects/[slug]/contractor-scopes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.project_type !== 'community') return NextResponse.json({ error: 'Not a community project' }, { status: 400 });

    await requireCommunityPermission(supabase, user.id, project.id, 'jobs', 'delete');

    const { error } = await supabase
      .from('contractor_scopes')
      .delete()
      .eq('project_id', project.id)
      .eq('id', id);

    if (error) {
      console.error('Error deleting contractor scope:', error);
      return NextResponse.json({ error: 'Failed to delete contractor scope' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'contractor_scope' as never,
      entityId: id,
      data: {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error in DELETE /api/projects/[slug]/contractor-scopes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
