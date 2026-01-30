import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { webhookDeliveryQuerySchema } from '@/lib/validators/webhook';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/webhooks/[id]/deliveries - List webhook deliveries
export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, id } = await context.params;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // Verify webhook exists and belongs to project
    const { data: webhook, error: webhookError } = await supabaseAny
      .from('webhooks')
      .select('id')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = webhookDeliveryQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      event_type: searchParams.get('event_type') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryResult.error.flatten() },
        { status: 400 }
      );
    }

    const { status, event_type, limit, offset } = queryResult.data;

    let query = supabaseAny
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', id);

    if (status) query = query.eq('status', status);
    if (event_type) query = query.eq('event_type', event_type);

    const { data: deliveries, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching webhook deliveries:', error);
      return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
    }

    return NextResponse.json({
      deliveries: deliveries ?? [],
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/webhooks/[id]/deliveries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
