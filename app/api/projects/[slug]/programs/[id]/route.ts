import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { updateProgramSchema } from '@/lib/validators/community/programs';
import type { Database } from '@/types/database';

type ProgramUpdate = Database['public']['Tables']['programs']['Update'];

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

    const { data: program, error } = await supabase
      .from('programs').select('*').eq('id', id).eq('project_id', project.id).single();
    if (error || !program) return NextResponse.json({ error: 'Program not found' }, { status: 404 });

    const [enrollmentResult, attendanceResult] = await Promise.all([
      supabase.from('program_enrollments').select('id', { count: 'exact', head: true }).eq('program_id', id),
      supabase.from('program_attendance').select('id', { count: 'exact', head: true }).eq('program_id', id),
    ]);

    return NextResponse.json({
      program: {
        ...program,
        enrollment_count: enrollmentResult.count ?? 0,
        attendance_count: attendanceResult.count ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/programs/[id]:', error);
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'update');

    const body = await request.json();
    const validationResult = updateProgramSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const updates = validationResult.data;
    const updateData: ProgramUpdate = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
    if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
    if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
    // requires_waiver is now auto-synced by the program_waivers trigger — skip direct writes
    if (updates.location_name !== undefined) updateData.location_name = updates.location_name;
    if (updates.location_latitude !== undefined) updateData.location_latitude = updates.location_latitude;
    if (updates.location_longitude !== undefined) updateData.location_longitude = updates.location_longitude;
    if (updates.target_dimensions !== undefined) updateData.target_dimensions = updates.target_dimensions as ProgramUpdate['target_dimensions'];
    if (updates.schedule !== undefined) updateData.schedule = updates.schedule as ProgramUpdate['schedule'];

    const { data: program, error } = await supabase
      .from('programs').update(updateData).eq('id', id).eq('project_id', project.id).select().single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      console.error('Error updating program:', error);
      return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
    }

    emitAutomationEvent({ projectId: project.id, triggerType: 'entity.updated', entityType: 'program', entityId: id, data: program as Record<string, unknown>, previousData: updates as Record<string, unknown> });
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        emitAutomationEvent({ projectId: project.id, triggerType: 'field.changed', entityType: 'program', entityId: id, data: program as Record<string, unknown>, previousData: { [key]: undefined } });
      }
    }

    return NextResponse.json({ program });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in PATCH /api/projects/[slug]/programs/[id]:', error);
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
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'delete');

    const { error } = await supabase
      .from('programs').delete().eq('id', id).eq('project_id', project.id).select('id').single();

    if (error) {
      if (error.code === 'PGRST116') return NextResponse.json({ error: 'Program not found' }, { status: 404 });
      console.error('Error deleting program:', error);
      return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
    }

    emitAutomationEvent({ projectId: project.id, triggerType: 'entity.deleted', entityType: 'program', entityId: id, data: { id, project_id: project.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in DELETE /api/projects/[slug]/programs/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
