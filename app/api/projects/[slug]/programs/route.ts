import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createProgramSchema } from '@/lib/validators/community/programs';
import { syncProgramSession } from '@/lib/assistant/calendar-bridge';
import type { Database } from '@/types/database';

type ProgramInsert = Database['public']['Tables']['programs']['Insert'];

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project, error: projectError } = await supabase
      .from('projects').select('*').eq('slug', slug).is('deleted_at', null).single();
    if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'view');

    const { searchParams } = new URL(request.url);
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const search = searchParams.get('search') ?? '';
    const sortBy = searchParams.get('sortBy') ?? 'created_at';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';
    const statusFilter = searchParams.get('status');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('programs')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id);

    if (search) {
      const sanitized = search.replace(/[%_\\]/g, '\\$&').replace(/"/g, '""');
      query = query.ilike('name', `%${sanitized}%`);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const ALLOWED_SORT = ['name', 'status', 'created_at', 'updated_at', 'start_date'];
    const ascending = sortOrder === 'asc';
    query = query.order(ALLOWED_SORT.includes(sortBy) ? sortBy : 'created_at', { ascending });
    query = query.range(offset, offset + limit - 1);

    const { data: programs, error, count } = await query;
    if (error) {
      console.error('Error fetching programs:', error);
      return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
    }

    return NextResponse.json({
      programs,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET /api/projects/[slug]/programs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project, error: projectError } = await supabase
      .from('projects').select('*').eq('slug', slug).is('deleted_at', null).single();
    if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'programs', 'create');

    const body = await request.json();
    const validationResult = createProgramSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const validated = validationResult.data;
    const insertData: ProgramInsert = {
      ...validated,
      project_id: project.id,
      target_dimensions: validated.target_dimensions as ProgramInsert['target_dimensions'],
      schedule: validated.schedule as ProgramInsert['schedule'],
    };

    const { data: program, error } = await supabase
      .from('programs').insert(insertData).select().single();

    if (error) {
      console.error('Error creating program:', error);
      return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
    }

    emitAutomationEvent({
      projectId: project.id,
      triggerType: 'entity.created',
      entityType: 'program',
      entityId: program.id,
      data: program as Record<string, unknown>,
    });

    let calendarSync: { synced: boolean; reason?: string; eventId?: string } | null = null;
    if (project.calendar_sync_enabled) {
      try {
        calendarSync = await syncProgramSession(program.id);
      } catch (calendarError) {
        console.error('Error syncing program session to Google Calendar:', calendarError);
        calendarSync = {
          synced: false,
          reason: calendarError instanceof Error ? calendarError.message : 'Program calendar sync failed',
        };
      }
    }

    return NextResponse.json({ program, calendar_sync: calendarSync }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST /api/projects/[slug]/programs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
