import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { emitAutomationEvent } from '@/lib/automations/engine';
import { createEventSeriesSchema } from '@/lib/validators/event';
import { generateSeriesInstances, serializeSeriesTicketTemplates } from '@/lib/events/series';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'view');

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const page = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('event_series')
      .select('*', { count: 'exact' })
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: series, error, count } = await query;
    if (error) {
      console.error('Error fetching event series:', error);
      return NextResponse.json({ error: 'Failed to fetch series' }, { status: 500 });
    }

    return NextResponse.json({
      series,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in GET series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: project } = await supabase
      .from('projects').select('id').eq('slug', slug).is('deleted_at', null).single();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    await requireCommunityPermission(supabase, user.id, project.id, 'events', 'create');

    const body = await request.json();
    const validationResult = createEventSeriesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }

    const validated = validationResult.data;
    const { ticket_types, ...seriesFields } = validated;

    const { data: series, error } = await supabase
      .from('event_series')
      .insert({
        ...seriesFields,
        ticket_types: serializeSeriesTicketTemplates(ticket_types ?? []) as unknown as import('@/types/database').Json,
        project_id: project.id,
        created_by: user.id,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event series:', error);
      return NextResponse.json({ error: 'Failed to create series' }, { status: 500 });
    }

    // Fire-and-forget: generate instances in the background so the API responds immediately.
    // The series detail page polls generation_status to show progress.
    generateSeriesInstances(series.id)
      .then((instanceCount) => {
        emitAutomationEvent({
          projectId: project.id,
          triggerType: 'event.created',
          entityType: 'event_series',
          entityId: series.id,
          data: { ...series as Record<string, unknown>, instances_generated: instanceCount },
        }).catch(err => console.error('Failed to emit automation event:', err));
      })
      .catch(err => console.error('Error generating series instances:', err));

    return NextResponse.json({ series, instances_generated: 0, generating: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error in POST series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
