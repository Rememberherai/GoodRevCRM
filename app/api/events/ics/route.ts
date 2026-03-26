import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateIcs } from '@/lib/calendar/ics';
import { checkRateLimit } from '@/lib/calendar/service';

type EventPayload = {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  venue_name?: string | null;
  venue_address?: string | null;
  virtual_url?: string | null;
  location_type?: string | null;
  organizer_name?: string | null;
  organizer_email?: string | null;
  calendar_slug?: string | null;
  event_slug?: string | null;
};

function getEventLocation(event: EventPayload): string {
  return event.location_type === 'virtual'
    ? event.virtual_url || 'Virtual'
    : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'TBD';
}

function getEventUrl(event: EventPayload): string | undefined {
  if (!event.calendar_slug || !event.event_slug || !process.env.NEXT_PUBLIC_APP_URL) {
    return undefined;
  }

  return `${process.env.NEXT_PUBLIC_APP_URL}/events/${event.calendar_slug}/${event.event_slug}`;
}

// GET /api/events/ics?token=<confirmation_token>
// GET /api/events/ics?calendar=<calendar_slug>&event=<event_slug>
export async function GET(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`ip:event-ics:${ip}`, 30, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const calendarSlug = searchParams.get('calendar');
    const eventSlug = searchParams.get('event');

    if (!token && (!calendarSlug || !eventSlug)) {
      return NextResponse.json({ error: 'Provide token or calendar and event slugs' }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (token) {
      const { data: registration, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          registrant_name,
          registrant_email,
          events(
            id,
            project_id,
            title,
            description,
            starts_at,
            ends_at,
            venue_name,
            venue_address,
            virtual_url,
            location_type,
            organizer_name,
            organizer_email,
            slug
          )
        `)
        .eq('confirmation_token', token)
        .single();

      if (error || !registration || !registration.events) {
        return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
      }

      const eventRow = registration.events as unknown as EventPayload & {
        project_id: string;
        slug?: string | null;
      };
      const { data: settings } = await supabase
        .from('event_calendar_settings')
        .select('slug')
        .eq('project_id', eventRow.project_id)
        .eq('is_enabled', true)
        .maybeSingle();
      const event = {
        ...eventRow,
        calendar_slug: settings?.slug ?? null,
        event_slug: eventRow.slug ?? null,
      };

      const icsContent = generateIcs({
        uid: registration.id,
        summary: event.title,
        description: event.description ?? `Registration confirmation for ${event.title}`,
        location: getEventLocation(event),
        startAt: event.starts_at,
        endAt: event.ends_at,
        organizerName: event.organizer_name || undefined,
        organizerEmail: event.organizer_email || undefined,
        attendeeName: registration.registrant_name,
        attendeeEmail: registration.registrant_email,
        url: getEventUrl(event),
      });

      return new NextResponse(icsContent, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="event.ics"',
        },
      });
    }

    const publicCalendarSlug = calendarSlug!;
    const publicEventSlug = eventSlug!;

    const { data: settings } = await supabase
      .from('event_calendar_settings')
      .select('project_id, slug')
      .eq('slug', publicCalendarSlug)
      .eq('is_enabled', true)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    const { data: event, error } = await supabase
      .from('events')
      .select('id, title, description, starts_at, ends_at, venue_name, venue_address, virtual_url, location_type, organizer_name, organizer_email, slug')
      .eq('project_id', settings.project_id)
      .eq('slug', publicEventSlug)
      .eq('status', 'published')
      .in('visibility', ['public', 'unlisted'])
      .single();

    if (error || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const publicEvent: EventPayload = {
      ...event,
      calendar_slug: settings.slug,
      event_slug: event.slug,
    };

    const icsContent = generateIcs({
      uid: event.id,
      summary: event.title,
      description: event.description ?? undefined,
      location: getEventLocation(publicEvent),
      startAt: event.starts_at,
      endAt: event.ends_at,
      organizerName: event.organizer_name || undefined,
      organizerEmail: event.organizer_email || undefined,
      url: getEventUrl(publicEvent),
    });

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="event.ics"',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/events/ics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
