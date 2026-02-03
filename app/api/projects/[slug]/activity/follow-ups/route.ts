import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { followUpQuerySchema } from '@/lib/validators/activity';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/activity/follow-ups - Follow-up queue
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = followUpQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      assigned_to: searchParams.get('assigned_to') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, assigned_to, limit, offset } = queryResult.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    let query = supabaseAny
      .from('activity_log')
      .select(`
        *,
        user:users!activity_log_user_id_fkey(id, full_name, email, avatar_url),
        person:people!activity_log_person_id_fkey(id, first_name, last_name, email),
        organization:organizations!activity_log_organization_id_fkey(id, name),
        follow_up_task:tasks!activity_log_follow_up_task_id_fkey(id, title, status, due_date, priority)
      `)
      .eq('project_id', project.id)
      .not('follow_up_date', 'is', null);

    // Date boundaries for status filters
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);

    if (status === 'overdue') {
      query = query
        .lt('follow_up_date', now.toISOString())
        .not('follow_up_task.status', 'eq', 'completed')
        .not('follow_up_task.status', 'eq', 'cancelled');
    } else if (status === 'today') {
      query = query
        .gte('follow_up_date', startOfToday.toISOString())
        .lte('follow_up_date', endOfToday.toISOString());
    } else if (status === 'upcoming') {
      const sevenDaysFromNow = new Date(endOfToday);
      sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);
      query = query
        .gt('follow_up_date', endOfToday.toISOString())
        .lte('follow_up_date', sevenDaysFromNow.toISOString());
    }

    if (assigned_to) {
      query = query.eq('user_id', assigned_to);
    }

    const { data: activities, error } = await query
      .order('follow_up_date', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching follow-ups:', error);
      return NextResponse.json({ error: 'Failed to fetch follow-ups' }, { status: 500 });
    }

    return NextResponse.json({
      activities: activities ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/activity/follow-ups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
