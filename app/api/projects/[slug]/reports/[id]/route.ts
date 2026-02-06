import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateReportSchema } from '@/lib/validators/report';

// GET /api/projects/[slug]/reports/[id] - Get report details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get report - use any to handle dynamic table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: report, error: reportError } = await (supabase as any)
      .from('report_definitions')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get recent runs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runs } = await (supabase as any)
      .from('report_runs')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      ...report,
      runs: runs || [],
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/reports/[id] - Update report
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check admin access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = updateReportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: report, error: updateError } = await (supabase as any)
      .from('report_definitions')
      .update(validationResult.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating report:', updateError);
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/reports/[id] - Delete report
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check admin access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('project_memberships')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('report_definitions')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (deleteError) {
      console.error('Error deleting report:', deleteError);
      return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[slug]/reports/[id] - Run report
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get report
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: report, error: reportError } = await (supabase as any)
      .from('report_definitions')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Create report run
    const startTime = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: run, error: runError } = await (supabase as any)
      .from('report_runs')
      .insert({
        report_id: id,
        project_id: project.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating report run:', runError);
      return NextResponse.json({ error: 'Failed to run report' }, { status: 500 });
    }

    // Execute report based on type (simplified implementation)
    let result = null;
    let error = null;

    try {
      const rpcParams = { p_project_id: project.id };
      switch (report.report_type) {
        case 'pipeline': {
          const { data: pipelineData } = await supabase.rpc(
            'get_pipeline_summary' as never,
            rpcParams as never
          );
          result = { data: pipelineData || [], summary: {} };
          break;
        }

        case 'conversion': {
          const { data: conversionData } = await supabase.rpc(
            'get_conversion_metrics' as never,
            rpcParams as never
          );
          result = { data: conversionData || [], summary: {} };
          break;
        }

        case 'revenue': {
          const { data: revenueData } = await supabase.rpc(
            'get_revenue_metrics' as never,
            rpcParams as never
          );
          result = { data: revenueData || [], summary: {} };
          break;
        }

        case 'team_performance': {
          const { data: teamData } = await supabase.rpc(
            'get_team_performance' as never,
            rpcParams as never
          );
          result = { data: teamData || [], summary: {} };
          break;
        }

        case 'activity': {
          const { data: activityData } = await supabase.rpc(
            'get_activity_summary' as never,
            rpcParams as never
          );
          result = { data: activityData || [], summary: {} };
          break;
        }

        default:
          result = { data: [], summary: {} };
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    const endTime = Date.now();

    // Update report run with results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('report_runs')
      .update({
        status: error ? 'failed' : 'completed',
        result: result,
        error_message: error,
        run_duration_ms: endTime - startTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    // Update report last_run_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('report_definitions')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({
      run_id: run.id,
      status: error ? 'failed' : 'completed',
      result,
      error_message: error,
      run_duration_ms: endTime - startTime,
    });
  } catch (error) {
    console.error('Error running report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
