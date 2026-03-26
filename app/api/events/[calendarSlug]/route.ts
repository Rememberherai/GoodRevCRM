import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ calendarSlug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { calendarSlug } = await context.params;

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(calendarSlug)) {
      return NextResponse.json({ error: 'Invalid calendar slug' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up calendar settings
    const { data: calendarSettings } = await supabase
      .from('event_calendar_settings')
      .select('*')
      .eq('slug', calendarSlug)
      .eq('is_enabled', true)
      .single();

    if (!calendarSettings) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Fetch published public events
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, slug, description, cover_image_url, category, tags, starts_at, ends_at, timezone, is_all_day, location_type, venue_name, venue_address, venue_latitude, venue_longitude, virtual_url, registration_enabled, total_capacity, organizer_name, series_id')
      .eq('project_id', calendarSettings.project_id)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Error fetching public events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Capacity is ticket-based, not registration-based.
    const eventIds = (events ?? []).map(e => e.id);
    const regCounts: Record<string, number> = {};

    if (eventIds.length > 0) {
      await Promise.all(eventIds.map(async (eventId) => {
        const { count } = await supabase
          .from('event_registration_tickets')
          .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
          .eq('event_registrations.event_id', eventId)
          .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);
        regCounts[eventId] = count ?? 0;
      }));
    }

    const eventsWithCapacity = (events ?? []).map(e => ({
      ...e,
      registered_count: regCounts[e.id] || 0,
      remaining_capacity: e.total_capacity != null
        ? Math.max(0, e.total_capacity - (regCounts[e.id] || 0))
        : null,
    }));

    return NextResponse.json({
      calendar: {
        title: calendarSettings.title,
        description: calendarSettings.description,
        logo_url: calendarSettings.logo_url,
        primary_color: calendarSettings.primary_color,
        timezone: calendarSettings.timezone,
      },
      events: eventsWithCapacity,
    });
  } catch (error) {
    console.error('Error in GET /api/events/[calendarSlug]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
