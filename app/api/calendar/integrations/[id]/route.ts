import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { revokeToken } from '@/lib/gmail/oauth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/calendar/integrations/[id]
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('calendar_integrations')
      .select('id, provider, email, calendar_id, is_primary, sync_enabled, push_enabled, last_synced_at, initial_sync_done, sync_errors_count, last_sync_error, status, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    return NextResponse.json({ integration: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/calendar/integrations/[id] — toggle sync_enabled / push_enabled
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.sync_enabled === 'boolean') updates.sync_enabled = body.sync_enabled;
    if (typeof body.push_enabled === 'boolean') updates.push_enabled = body.push_enabled;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calendar_integrations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, sync_enabled, push_enabled')
      .single();

    if (error || !data) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    return NextResponse.json({ integration: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/calendar/integrations/[id] — disconnect and remove
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Load integration to get token for revocation
    const serviceClient = createServiceClient();
    const { data: integration } = await serviceClient
      .from('calendar_integrations')
      .select('access_token, refresh_token')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!integration) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });

    // Revoke token at Google (fire-and-forget).
    // Prefer revoking the refresh token — it revokes the entire grant.
    const tokenToRevoke = integration.refresh_token || integration.access_token;
    if (tokenToRevoke) {
      revokeToken(tokenToRevoke).catch(() => {});
    }

    // Delete integration (CASCADE deletes synced_events)
    const { error } = await serviceClient
      .from('calendar_integrations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
