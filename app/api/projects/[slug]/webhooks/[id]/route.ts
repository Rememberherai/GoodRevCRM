import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { updateWebhookSchema } from '@/lib/validators/webhook';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

// GET /api/projects/[slug]/webhooks/[id] - Get webhook
export async function GET(_request: Request, context: RouteContext) {
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

    const { data: webhook, error } = await supabaseAny
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .eq('project_id', project.id)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Get delivery stats
    const { data: stats } = await supabaseAny
      .from('webhook_deliveries')
      .select('status')
      .eq('webhook_id', id);

    const deliveryStats = {
      total_deliveries: stats?.length ?? 0,
      successful_deliveries: stats?.filter((d: { status: string }) => d.status === 'delivered').length ?? 0,
      failed_deliveries: stats?.filter((d: { status: string }) => d.status === 'failed').length ?? 0,
    };

    // Get last delivery
    const { data: lastDelivery } = await supabaseAny
      .from('webhook_deliveries')
      .select('delivered_at')
      .eq('webhook_id', id)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      ...webhook,
      ...deliveryStats,
      last_delivery_at: lastDelivery?.delivered_at ?? null,
    });
  } catch (error) {
    console.error('Error in GET /api/projects/[slug]/webhooks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/webhooks/[id] - Update webhook
export async function PATCH(request: Request, context: RouteContext) {
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

    // Check admin permissions
    const { data: membership } = await supabaseAny
      .from('project_members')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateWebhookSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { data: webhook, error } = await supabaseAny
      .from('webhooks')
      .update(validationResult.data)
      .eq('id', id)
      .eq('project_id', project.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating webhook:', error);
      return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
    }

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Error in PATCH /api/projects/[slug]/webhooks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/webhooks/[id] - Delete webhook
export async function DELETE(_request: Request, context: RouteContext) {
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

    // Check admin permissions
    const { data: membership } = await supabaseAny
      .from('project_members')
      .select('role')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin role required.' },
        { status: 403 }
      );
    }

    const { error } = await supabaseAny
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('project_id', project.id);

    if (error) {
      console.error('Error deleting webhook:', error);
      return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/webhooks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
