import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateIcsFeed, type IcsFeedEvent } from '@/lib/calendar/ics';
import { checkRateLimit } from '@/lib/calendar/service';

interface RouteContext {
  params: Promise<{ calendarSlug: string }>;
}

function getEventLocation(event: {
  location_type: string | null;
  venue_name: string | null;
  venue_address: string | null;
  virtual_url: string | null;
}): string {
  return event.location_type === 'virtual'
    ? event.virtual_url || 'Virtual'
    : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || '';
}

// GET /api/events/[calendarSlug]/feed — iCal subscription feed
export async function GET(request: Request, context: RouteContext) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit(`ip:event-feed:${ip}`, 60, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { calendarSlug } = await context.params;
    const supabase = createServiceClient();

    const { data: settings } = await supabase
      .from('event_calendar_settings')
      .select('project_id, title, slug, description, timezone')
      .eq('slug', calendarSlug)
      .eq('is_enabled', true)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    // Include events from 90 days ago onward so subscribers see recent history
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const { data: events } = await supabase
      .from('events')
      .select('id, title, description, starts_at, ends_at, slug, location_type, venue_name, venue_address, virtual_url')
      .eq('project_id', settings.project_id)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .gte('starts_at', cutoff.toISOString())
      .order('starts_at', { ascending: true })
      .limit(500);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    const feedEvents: IcsFeedEvent[] = (events ?? []).map((e) => ({
      uid: e.id,
      summary: e.title,
      description: e.description || undefined,
      location: getEventLocation(e) || undefined,
      startAt: e.starts_at,
      endAt: e.ends_at,
      url: e.slug && settings.slug ? `${appUrl}/events/${settings.slug}/${e.slug}` : undefined,
    }));

    const icsContent = generateIcsFeed(settings.title || 'Events', feedEvents, {
      description: settings.description || undefined,
      timezone: settings.timezone || undefined,
    });

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/events/[calendarSlug]/feed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
