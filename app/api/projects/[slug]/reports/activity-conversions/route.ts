import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/reports/activity-conversions
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
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();
    const userIdFilter = searchParams.get('user_id') || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_activity_conversion_metrics', {
      p_project_id: project.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_user_id: userIdFilter,
    });

    if (error) {
      console.error('Activity conversion metrics error:', error);
      return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Activity conversions route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
