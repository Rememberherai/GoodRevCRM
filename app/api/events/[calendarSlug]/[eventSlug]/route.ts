import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ calendarSlug: string; eventSlug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { calendarSlug, eventSlug } = await context.params;
    const supabase = createServiceClient();

    // Look up calendar settings
    const { data: calendarSettings } = await supabase
      .from('event_calendar_settings')
      .select('project_id, title, primary_color, timezone')
      .eq('slug', calendarSlug)
      .eq('is_enabled', true)
      .single();

    if (!calendarSettings) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Fetch event (public or unlisted)
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('project_id', calendarSettings.project_id)
      .eq('slug', eventSlug)
      .eq('status', 'published')
      .in('visibility', ['public', 'unlisted'])
      .single();

    if (error || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch ticket types
    const { data: rawTicketTypes } = await supabase
      .from('event_ticket_types')
      .select('id, name, description, price_cents, currency, quantity_available, max_per_order, sort_order, sales_start_at, sales_end_at, is_active, is_hidden')
      .eq('event_id', event.id)
      .eq('is_active', true)
      .eq('is_hidden', false)
      .order('sort_order', { ascending: true });

    const nowIso = new Date().toISOString();
    const ticketTypes = (rawTicketTypes ?? []).filter((ticketType) => {
      if (ticketType.sales_start_at && ticketType.sales_start_at > nowIso) return false;
      if (ticketType.sales_end_at && ticketType.sales_end_at < nowIso) return false;
      return true;
    });

    // Get sold counts per ticket type using count queries (avoids PostgREST 1000-row limit)
    const ticketTypeIds = (ticketTypes ?? []).map(tt => tt.id);
    const soldCounts: Record<string, number> = {};

    if (ticketTypeIds.length > 0) {
      await Promise.all(ticketTypeIds.map(async (ttId) => {
        const { count } = await supabase
          .from('event_registration_tickets')
          .select('id, event_registrations!inner(id, status)', { count: 'exact', head: true })
          .eq('ticket_type_id', ttId)
          .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);
        soldCounts[ttId] = count ?? 0;
      }));
    }

    const ticketTypesWithAvailability = (ticketTypes ?? []).map(tt => ({
      ...tt,
      sold: soldCounts[tt.id] || 0,
      remaining: tt.quantity_available != null
        ? Math.max(0, tt.quantity_available - (soldCounts[tt.id] || 0))
        : null,
    }));

    // Event capacity is based on issued tickets, not registration rows.
    const { count: registeredCount } = await supabase
      .from('event_registration_tickets')
      .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
      .eq('event_registrations.event_id', event.id)
      .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description,
        description_html: event.description_html,
        cover_image_url: event.cover_image_url,
        category: event.category,
        tags: event.tags,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        timezone: event.timezone,
        is_all_day: event.is_all_day,
        location_type: event.location_type,
        venue_name: event.venue_name,
        venue_address: event.venue_address,
        venue_latitude: event.venue_latitude,
        venue_longitude: event.venue_longitude,
        virtual_url: event.virtual_url,
        recording_url: event.recording_url,
        registration_enabled: event.registration_enabled,
        registration_opens_at: event.registration_opens_at,
        registration_closes_at: event.registration_closes_at,
        total_capacity: event.total_capacity,
        waitlist_enabled: event.waitlist_enabled,
        require_approval: event.require_approval,
        custom_questions: event.custom_questions,
        organizer_name: event.organizer_name,
        organizer_email: event.organizer_email,
        confirmation_message: event.confirmation_message,
        cancellation_policy: event.cancellation_policy,
        requires_waiver: event.requires_waiver,
        series_id: event.series_id,
        registered_count: registeredCount ?? 0,
        remaining_capacity: event.total_capacity != null
          ? Math.max(0, event.total_capacity - (registeredCount ?? 0))
          : null,
      },
      ticket_types: ticketTypesWithAvailability,
      calendar: {
        title: calendarSettings.title,
        primary_color: calendarSettings.primary_color,
        timezone: calendarSettings.timezone,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/events/[calendarSlug]/[eventSlug]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
