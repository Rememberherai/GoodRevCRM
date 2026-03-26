import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PublicEventDetail } from '@/app/events/[calendarSlug]/[eventSlug]/public-event-detail';

interface PageProps {
  params: Promise<{ calendarSlug: string; eventSlug: string }>;
}

export default async function EmbeddedEventPage({ params }: PageProps) {
  const { calendarSlug, eventSlug } = await params;
  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from('event_calendar_settings')
    .select('project_id')
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

  const { count: registeredCount } = await supabase
    .from('event_registration_tickets')
    .select('id, event_registrations!inner(id, event_id, status)', { count: 'exact', head: true })
    .eq('event_registrations.event_id', event.id)
    .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);

  const remainingCapacity = event.total_capacity != null
    ? Math.max(0, event.total_capacity - (registeredCount ?? 0))
    : null;

  const ticketTypeIds = ticketTypes.map((ticketType) => ticketType.id);
  const soldCounts: Record<string, number> = {};
  if (ticketTypeIds.length > 0) {
    await Promise.all(ticketTypeIds.map(async (ticketTypeId) => {
      const { count } = await supabase
        .from('event_registration_tickets')
        .select('id, event_registrations!inner(id, status)', { count: 'exact', head: true })
        .eq('ticket_type_id', ticketTypeId)
        .in('event_registrations.status', ['confirmed', 'pending_approval', 'pending_waiver']);
      soldCounts[ticketTypeId] = count ?? 0;
    }));
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <PublicEventDetail
        event={{ ...event, remaining_capacity: remainingCapacity }}
        ticketTypes={ticketTypes.map((ticketType) => ({
          ...ticketType,
          remaining: ticketType.quantity_available != null
            ? Math.max(0, ticketType.quantity_available - (soldCounts[ticketType.id] || 0))
            : null,
        }))}
        calendarSlug={calendarSlug}
        embed
      />
    </div>
  );
}
