import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// POST /api/projects/[slug]/reports/[id]/run - Execute a report
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
    const supabase = await createClient();
    const startTime = Date.now();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Fetch the report definition
    const { data: report, error: reportError } = await supabaseAny
      .from('report_definitions')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Create a report run entry
    const { data: run, error: runError } = await supabaseAny
      .from('report_runs')
      .insert({
        report_id: id,
        project_id: project.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError || !run) {
      console.error('Error creating report run:', runError);
      return NextResponse.json({ error: 'Failed to start report run' }, { status: 500 });
    }

    // Execute the report based on type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as any;

    let result: Record<string, unknown>[] = [];
    const filters = report.filters ?? {};
    const startDate = filters.date_range?.start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = filters.date_range?.end ?? new Date().toISOString();

    try {
      switch (report.report_type) {
        case 'pipeline': {
          const { data } = await rpc('get_pipeline_summary', {
            p_project_id: project.id,
          });
          result = data ?? [];
          break;
        }
        case 'conversion': {
          const { data } = await rpc('get_conversion_metrics', {
            p_project_id: project.id,
            p_start_date: startDate,
            p_end_date: endDate,
          });
          result = data ?? [];
          break;
        }
        case 'revenue': {
          const { data } = await rpc('get_revenue_metrics', {
            p_project_id: project.id,
            p_start_date: startDate,
            p_end_date: endDate,
          });
          result = data ?? [];
          break;
        }
        case 'team_performance': {
          const { data } = await rpc('get_team_performance', {
            p_project_id: project.id,
            p_start_date: startDate,
            p_end_date: endDate,
          });
          result = data ?? [];
          break;
        }
        case 'activity': {
          const { data } = await rpc('get_activity_summary', {
            p_project_id: project.id,
            p_start_date: startDate,
            p_end_date: endDate,
          });
          result = data ?? [];
          break;
        }
        default:
          result = [];
      }

      const duration = Date.now() - startTime;

      // Update the report run with results
      await supabaseAny
        .from('report_runs')
        .update({
          status: 'completed',
          result: { data: result, metadata: { total_rows: result.length, generated_at: new Date().toISOString() } },
          run_duration_ms: duration,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);

      // Update last_run_at on the report definition
      await supabaseAny
        .from('report_definitions')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', id);

      return NextResponse.json({
        run_id: run.id,
        status: 'completed',
        result: { data: result, metadata: { total_rows: result.length, generated_at: new Date().toISOString() } },
        duration_ms: duration,
      });
    } catch (execError) {
      const duration = Date.now() - startTime;
      const errorMessage = execError instanceof Error ? execError.message : 'Report execution failed';

      await supabaseAny
        .from('report_runs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          run_duration_ms: duration,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/reports/[id]/run:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
