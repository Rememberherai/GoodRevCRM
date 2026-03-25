import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { addProgramWaiverSchema } from '@/lib/validators/community/programs';

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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'view');

    const { data: program } = await supabase
      .from('programs').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const { data: waivers, error } = await supabase
      .from('program_waivers')
      .select('id, template_id, created_at, contract_templates ( id, name, file_name, description, category )')
      .eq('program_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching program waivers:', error);
      return NextResponse.json({ error: 'Failed to fetch waivers' }, { status: 500 });
    }

    return NextResponse.json({ waivers: waivers ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/programs/[id]/waivers:', error);
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'create');

    const { data: program } = await supabase
      .from('programs').select('id').eq('id', id).eq('project_id', project.id).single();
    if (!program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const body = await request.json();
    const validation = addProgramWaiverSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    // Verify template exists and belongs to this project
    const { data: template } = await supabase
      .from('contract_templates')
      .select('id, name')
      .eq('id', validation.data.template_id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (!template) {
      return NextResponse.json({ error: 'Contract template not found in this project' }, { status: 404 });
    }

    const { data: waiver, error } = await supabase
      .from('program_waivers')
      .insert({ program_id: id, template_id: validation.data.template_id })
      .select('id, template_id, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This template is already linked to the program' }, { status: 409 });
      }
      console.error('Error creating program waiver:', error);
      return NextResponse.json({ error: 'Failed to add waiver' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created' as never,
      entityType: 'program_waiver' as never,
      entityId: waiver.id,
      data: { ...waiver, program_id: id, template_name: template.name },
    });

    return NextResponse.json({ waiver }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/programs/[id]/waivers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'delete');

    const url = new URL(request.url);
    const waiverId = url.searchParams.get('waiverId');
    if (!waiverId) {
      return NextResponse.json({ error: 'waiverId query parameter is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('program_waivers')
      .delete()
      .eq('id', waiverId)
      .eq('program_id', id)
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Waiver not found' }, { status: 404 });
      console.error('Error deleting program waiver:', error);
      return NextResponse.json({ error: 'Failed to remove waiver' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.deleted' as never,
      entityType: 'program_waiver' as never,
      entityId: waiverId,
      data: { id: waiverId, program_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE /api/projects/[slug]/programs/[id]/waivers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
