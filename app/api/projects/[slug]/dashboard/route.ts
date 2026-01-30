import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/dashboard - Get dashboard stats
export async function GET(_request: Request, context: RouteContext) {
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
      .select('id, name, slug')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Call the get_dashboard_stats function
    const { data: stats, error: statsError } = await supabaseAny.rpc('get_dashboard_stats', {
      p_project_id: project.id,
    });

    if (statsError) {
      console.error('Error fetching dashboard stats:', statsError);
      return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
    }

    // Get recent activity
    const [
      { data: recentPeople },
      { data: recentOpportunities },
      { data: recentTasks },
    ] = await Promise.all([
      supabase
        .from('people')
        .select('id, first_name, last_name, email, created_at')
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('opportunities')
        .select('id, name, stage, value, created_at')
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAny
        .from('tasks')
        .select('id, title, status, priority, due_date, created_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // Get upcoming tasks (due soon)
    const { data: upcomingTasks } = await supabaseAny
      .from('tasks')
      .select('id, title, status, priority, due_date, assignee:users!tasks_assigned_to_fkey(id, full_name, avatar_url)')
      .eq('project_id', project.id)
      .in('status', ['todo', 'in_progress'])
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(10);

    // Get pipeline summary
    const { data: pipelineData } = await supabase
      .from('opportunities')
      .select('stage, value')
      .eq('project_id', project.id)
      .is('deleted_at', null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline = (pipelineData ?? []).reduce(
      (acc, opp: any) => {
        const stage = opp.stage || 'unknown';
        if (!acc[stage]) {
          acc[stage] = { count: 0, value: 0 };
        }
        acc[stage].count += 1;
        acc[stage].value += opp.value || 0;
        return acc;
      },
      {} as Record<string, { count: number; value: number }>
    );

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      stats: stats?.[0] ?? {
        total_people: 0,
        total_organizations: 0,
        total_opportunities: 0,
        total_rfps: 0,
        total_tasks: 0,
        pending_tasks: 0,
        total_pipeline_value: 0,
        won_value: 0,
        emails_sent: 0,
        emails_opened: 0,
      },
      recentActivity: {
        people: recentPeople ?? [],
        opportunities: recentOpportunities ?? [],
        tasks: recentTasks ?? [],
      },
      upcomingTasks: upcomingTasks ?? [],
      pipeline,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
