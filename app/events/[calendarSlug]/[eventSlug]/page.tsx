import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicEventDetail } from './public-event-detail';

interface PageProps {
  params: Promise<{ calendarSlug: string; eventSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { calendarSlug, eventSlug } = await params;
  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from('event_calendar_settings')
    .select('project_id')
    .eq('slug', calendarSlug)
    .eq('is_enabled', true)
    .single();

  if (!settings) return { title: 'Event Not Found' };

  const { data: event } = await supabase
    .from('events')
    .select('title, description, cover_image_url')
    .eq('project_id', settings.project_id)
    .eq('slug', eventSlug)
    .eq('status', 'published')
    .in('visibility', ['public', 'unlisted'])
    .single();

  if (!event) return { title: 'Event Not Found' };

  return {
    title: event.title,
    description: event.description ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      images: event.cover_image_url ? [event.cover_image_url] : undefined,
    },
  };
}

export default async function PublicEventPage({ params }: PageProps) {
  const { calendarSlug, eventSlug } = await params;
  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from('event_calendar_settings')
    .select('project_id, title, primary_color, timezone')
    .eq('slug', calendarSlug)
    .eq('is_enabled', true)
    .single();

  if (!settings) notFound();

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('project_id', settings.project_id)
    .eq('slug', eventSlug)
    .eq('status', 'published')
    .in('visibility', ['public', 'unlisted'])
    .single();

  if (!event) notFound();

  const { data: rawTicketTypes } = await supabase
    .from('event_ticket_types')
    .select('*')
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

  // Compute remaining capacity for the event and per ticket type
  const { count: registeredCount } = await supabase
    .from('event_registration_tickets')
    .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
    .eq('event_registrations.event_id', event.id)
    .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);

  const remainingCapacity = event.total_capacity != null
    ? Math.max(0, event.total_capacity - (registeredCount ?? 0))
    : null;

  // Compute sold counts per ticket type for remaining availability
  const ticketTypeIds = (ticketTypes ?? []).map(tt => tt.id);
  let soldCounts: Record<string, number> = {};
  if (ticketTypeIds.length > 0) {
    const { data: tickets } = await supabase
      .from('event_registration_tickets')
      .select('ticket_type_id, event_registrations!inner(status)')
      .in('ticket_type_id', ticketTypeIds)
      .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);
    if (tickets) {
      soldCounts = tickets.reduce((acc, t) => {
        acc[t.ticket_type_id] = (acc[t.ticket_type_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
  }

  const ticketTypesWithRemaining = (ticketTypes ?? []).map(tt => ({
    ...tt,
    remaining: tt.quantity_available != null
      ? Math.max(0, tt.quantity_available - (soldCounts[tt.id] || 0))
      : null,
  }));

  return (
    <PublicEventDetail
      event={{ ...event, remaining_capacity: remainingCapacity }}
      ticketTypes={ticketTypesWithRemaining}
      calendarSlug={calendarSlug}
    />
  );
}
