import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { updateGrantSchema } from '@/lib/validators/community/grants';
import { emitAutomationEvent } from '@/lib/automations/engine';
import type { Database } from '@/types/database';

type GrantUpdate = Database['public']['Tables']['grants']['Update'];

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
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'view');

    const { data, error } = await supabase
      .from('grants')
      .select(`
        *,
        funder:organizations!grants_funder_organization_id_fkey(id, name),
        contact:people!grants_contact_person_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    return NextResponse.json({ grant: data });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in GET /api/projects/[slug]/grants/[id]:', error);
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
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'update');

    // Fetch existing grant to detect status/agreement changes
    const { data: existingGrant } = await supabase
      .from('grants')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (!existingGrant) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    const body = await request.json();
    const validation = updateGrantSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { project_id: _pid, ...validatedUpdates } = validation.data; // eslint-disable-line @typescript-eslint/no-unused-vars
    const updateData: GrantUpdate = { ...validatedUpdates };

    const { data, error } = await supabase
      .from('grants')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', project.id)
      .select(`
        *,
        funder:organizations!grants_funder_organization_id_fkey(id, name),
        contact:people!grants_contact_person_id_fkey(id, first_name, last_name, email)
      `)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Grant not found' }, { status: 404 });

    // Detect agreement status change → emit agreement executed trigger
    if (validation.data.agreement_status === 'executed' && existingGrant.agreement_status !== 'executed') {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'grant.agreement_executed' as never,
        entityType: 'grant' as never,
        entityId: id,
        data: data as unknown as Record<string, unknown>,
      });
    }

    // Detect status change → emit specific trigger
    const statusChanged = validation.data.status && validation.data.status !== existingGrant.status;
    if (statusChanged) {
      emitAutomationEvent({
        projectId: project.id,
        triggerType: 'grant.status_changed' as never,
        entityType: 'grant' as never,
        entityId: id,
        data: data as unknown as Record<string, unknown>,
        previousData: { status: existingGrant.status },
      });
    }

    // When status transitions to 'awarded', auto-create a contribution of type 'grant'
    if (statusChanged && validation.data.status === 'awarded' && data.amount_awarded) {
      const { error: contribError } = await supabase
        .from('contributions')
        .insert({
          project_id: project.id,
          type: 'grant',
          status: 'received',
          description: `Grant Award: ${data.name}`,
          value: data.amount_awarded,
          currency: 'USD',
          donor_organization_id: data.funder_organization_id,
          grant_id: data.id,
          date: new Date().toISOString().slice(0, 10),
        });

      if (contribError) {
        console.error('Failed to auto-create contribution for awarded grant:', contribError);
      }
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'grant' as never,
      entityId: id,
      data: data as unknown as Record<string, unknown>,
      previousData: existingGrant as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ grant: data });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in PATCH /api/projects/[slug]/grants/[id]:', error);
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
    if (!project || !['community', 'grants'].includes(project.project_type))
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'grants', 'delete');

    // Clean up storage files before deleting (CASCADE will remove grant_documents rows)
    const { data: docs } = await supabase
      .from('grant_documents')
      .select('file_path')
      .eq('grant_id', id)
      .eq('project_id', project.id);
    if (docs && docs.length > 0) {
      const paths = docs.map((d) => d.file_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('grant-documents').remove(paths);
      }
    }

    const { error } = await supabase.from('grants').delete().eq('id', id).eq('project_id', project.id);
    if (error) throw error;

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted',
      entityType: 'grant' as never,
      entityId: id,
      data: { id, project_id: project.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error in DELETE /api/projects/[slug]/grants/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
