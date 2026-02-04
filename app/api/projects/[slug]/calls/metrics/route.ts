import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { callMetricsQuerySchema } from '@/lib/validators/call';
import { getCallMetrics } from '@/lib/telnyx/service';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/projects/[slug]/calls/metrics - Get call analytics
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
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

    const { searchParams } = new URL(request.url);
    const queryResult = callMetricsQuerySchema.safeParse({
      start_date: searchParams.get('start_date'),
      end_date: searchParams.get('end_date'),
      user_id: searchParams.get('user_id') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const metrics = await getCallMetrics({
      projectId: project.id,
      startDate: queryResult.data.start_date,
      endDate: queryResult.data.end_date,
      userId: queryResult.data.user_id,
    });

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/calls/metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
