import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/book/profile/[slug] — Public profile + event types via RPCs
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;

    // Validate slug format to avoid passing arbitrary strings to RPC
    if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.length > 100) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const supabase = createServiceClient();

    // Fetch public profile via RPC
    const { data: profiles, error: profileError } = await supabase.rpc(
      'get_public_calendar_profile',
      { p_slug: slug }
    );

    if (profileError || !profiles || (profiles as unknown[]).length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = (profiles as unknown[])[0];

    // Fetch public event types via RPC
    const { data: eventTypes, error: etError } = await supabase.rpc(
      'get_public_event_types',
      { p_slug: slug }
    );

    if (etError) {
      return NextResponse.json({ error: 'Failed to load event types' }, { status: 500 });
    }

    // Enrich event types with scheduling_type (not in the RPC)
    const rpcEventTypes = (eventTypes || []) as Record<string, unknown>[];
    let enrichedEventTypes: Record<string, unknown>[] = rpcEventTypes;
    if (rpcEventTypes.length > 0) {
      const etIds = rpcEventTypes.map((et) => et.id as string);
      const { data: schedulingData } = await supabase
        .from('event_types')
        .select('id, scheduling_type')
        .in('id', etIds);
      if (schedulingData) {
        const schedulingMap = new Map(
          schedulingData.map((s) => [s.id, s.scheduling_type])
        );
        enrichedEventTypes = rpcEventTypes.map((et) => ({
          ...et,
          scheduling_type: schedulingMap.get(et.id as string) || 'one_on_one',
        }));
      }
    }

    return NextResponse.json({
      profile,
      event_types: enrichedEventTypes,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
