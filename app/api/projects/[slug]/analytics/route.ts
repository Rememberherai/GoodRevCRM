import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { metricsQuerySchema } from '@/lib/validators/report';

// GET /api/projects/[slug]/analytics - Get analytics overview
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryResult = metricsQuerySchema.safeParse(searchParams);

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { start_date, end_date } = queryResult.data;

    // Build RPC params - cast to unknown to bypass strict typing for dynamic functions
    const rpcParams = {
      p_project_id: project.id,
      ...(start_date && { p_start_date: start_date }),
      ...(end_date && { p_end_date: end_date }),
    } as unknown;

    // Get pipeline summary
    const { data: pipeline, error: pipelineError } = await supabase.rpc(
      'get_pipeline_summary' as never,
      { p_project_id: project.id } as never
    );

    if (pipelineError) {
      console.error('Pipeline error:', pipelineError);
    }

    // Get conversion metrics
    const { data: conversion, error: conversionError } = await supabase.rpc(
      'get_conversion_metrics' as never,
      rpcParams as never
    );

    if (conversionError) {
      console.error('Conversion error:', conversionError);
    }

    // Get revenue metrics
    const { data: revenue, error: revenueError } = await supabase.rpc(
      'get_revenue_metrics' as never,
      rpcParams as never
    );

    if (revenueError) {
      console.error('Revenue error:', revenueError);
    }

    // Get team performance
    const { data: team, error: teamError } = await supabase.rpc(
      'get_team_performance' as never,
      rpcParams as never
    );

    if (teamError) {
      console.error('Team error:', teamError);
    }

    // Get activity summary
    const { data: activity, error: activityError } = await supabase.rpc(
      'get_activity_summary' as never,
      rpcParams as never
    );

    if (activityError) {
      console.error('Activity error:', activityError);
    }

    return NextResponse.json({
      pipeline: pipeline || [],
      conversion: conversion || [],
      revenue: revenue || [],
      team: team || [],
      activity: activity || [],
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
