import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, getProjectBySlug } from '@/lib/community/server';
import { requireCommunityPermission } from '@/lib/projects/community-permissions';
import { ProjectAccessError } from '@/lib/projects/permissions';
import { caseTimelineQuerySchema } from '@/lib/validators/case';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

type TimelineItem = {
  id: string;
  type: 'intake' | 'referral' | 'note' | 'task' | 'case_event' | 'incident';
  timestamp: string;
  summary: string;
  actor: { id: string; name: string } | null;
  metadata: Record<string, unknown>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await getProjectBySlug(supabase, slug);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireCommunityPermission(supabase, user.id, project.id, 'cases', 'view');

    const { searchParams } = new URL(request.url);
    const queryResult = caseTimelineQuerySchema.safeParse({
      cursor: searchParams.get('cursor') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      types: searchParams.get('types') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, { status: 400 });
    }

    const { cursor, limit, types } = queryResult.data;
    const cutoff = cursor ?? new Date().toISOString();
    const allowed = new Set(types);
    const supabaseAny = supabase as any;

    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .single();

    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const [intakeResult, referralResult, noteResult, taskResult, caseEventResult, incidentResult] = await Promise.all([
      allowed.has('intake')
        ? supabaseAny
            .from('household_intake')
            .select('*')
            .eq('household_id', id)
            .lte('assessed_at', cutoff)
            .order('assessed_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
      allowed.has('referral')
        ? supabaseAny
            .from('referrals')
            .select('*')
            .eq('project_id', project.id)
            .eq('household_id', id)
            .lte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
      allowed.has('note')
        ? supabaseAny
            .from('notes')
            .select('*, author:users!notes_created_by_fkey(id, full_name)')
            .eq('project_id', project.id)
            .eq('household_id', id)
            .lte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
      allowed.has('task')
        ? supabaseAny
            .from('tasks')
            .select('*, assigned_user:users!tasks_assigned_to_fkey(id, full_name)')
            .eq('project_id', project.id)
            .eq('household_id', id)
            .lte('updated_at', cutoff)
            .order('updated_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
      allowed.has('case_event')
        ? supabaseAny
            .from('household_case_events')
            .select('*, author:users!household_case_events_created_by_fkey(id, full_name)')
            .eq('project_id', project.id)
            .eq('household_id', id)
            .lte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
      allowed.has('incident')
        ? supabaseAny
            .from('incidents')
            .select('*, reporter:users!incidents_reported_by_fkey(id, full_name)')
            .eq('project_id', project.id)
            .eq('household_id', id)
            .lte('occurred_at', cutoff)
            .order('occurred_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
    ]);

    const items: TimelineItem[] = [];

    for (const record of intakeResult.data ?? []) {
      items.push({
        id: record.id,
        type: 'intake',
        timestamp: record.assessed_at,
        summary: `Intake ${record.status ?? 'recorded'}`,
        actor: null,
        metadata: record,
      });
    }

    for (const record of referralResult.data ?? []) {
      items.push({
        id: record.id,
        type: 'referral',
        timestamp: record.created_at,
        summary: record.notes ? `Referral created: ${String(record.notes).slice(0, 120)}` : `Referral ${record.status ?? 'created'}`,
        actor: null,
        metadata: record,
      });
    }

    for (const record of noteResult.data ?? []) {
      items.push({
        id: record.id,
        type: 'note',
        timestamp: record.created_at,
        summary: String(record.content ?? '').slice(0, 140),
        actor: record.author ? { id: record.author.id, name: record.author.full_name ?? 'Unknown' } : null,
        metadata: record,
      });
    }

    for (const record of taskResult.data ?? []) {
      items.push({
        id: record.id,
        type: 'task',
        timestamp: record.updated_at ?? record.created_at,
        summary: `Task: ${record.title}`,
        actor: record.assigned_user ? { id: record.assigned_user.id, name: record.assigned_user.full_name ?? 'Unknown' } : null,
        metadata: record,
      });
    }

    for (const record of caseEventResult.data ?? []) {
      items.push({
        id: record.id,
        type: 'case_event',
        timestamp: record.created_at,
        summary: record.summary,
        actor: record.author ? { id: record.author.id, name: record.author.full_name ?? 'Unknown' } : null,
        metadata: record.metadata ?? {},
      });
    }

    for (const record of incidentResult.data ?? []) {
      items.push({
        id: record.id,
        type: 'incident',
        timestamp: record.occurred_at,
        summary: `${record.severity} incident: ${record.summary}`,
        actor: record.reporter ? { id: record.reporter.id, name: record.reporter.full_name ?? 'Unknown' } : null,
        metadata: record,
      });
    }

    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const sliced = items.slice(0, limit);
    const nextCursor = sliced.length === limit ? sliced[sliced.length - 1]?.timestamp ?? null : null;

    return NextResponse.json({ items: sliced, next_cursor: nextCursor });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/projects/[slug]/households/[id]/timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
