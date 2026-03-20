import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { batchAttendanceSchema } from '@/lib/validators/community/programs';
import type { Database } from '@/types/database';

type ProgramAttendanceInsert = Database['public']['Tables']['program_attendance']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'view');

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    let query = supabase
      .from('program_attendance')
      .select('*, person:people(id, first_name, last_name, email)')
      .eq('program_id', id)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('date', date);
    }

    const { data: attendance, error } = await query;
    if (error) {
      console.error('Error fetching attendance:', error);
      return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }

    return NextResponse.json({ attendance: attendance ?? [] });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/programs/[id]/attendance:', error);
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
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'create');

    const body = await request.json();
    const validation = batchAttendanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const entries: ProgramAttendanceInsert[] = validation.data.entries.map((entry) => ({
      program_id: id,
      person_id: entry.person_id,
      date: validation.data.date,
      status: entry.status,
      hours: entry.hours ?? 0,
    }));

    const { data: attendance, error } = await supabase
      .from('program_attendance')
      .upsert(entries, { onConflict: 'program_id,person_id,date' })
      .select();

    if (error) {
      console.error('Error saving attendance:', error);
      return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.updated',
      entityType: 'program_attendance',
      entityId: id,
      data: { program_id: id, date: validation.data.date, count: attendance?.length ?? 0 },
    });

    return NextResponse.json({ attendance: attendance ?? [] }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in POST /api/projects/[slug]/programs/[id]/attendance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
