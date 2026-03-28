import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicEventList } from './public-event-list';

interface PageProps {
  params: Promise<{ calendarSlug: string }>;
}

async function loadPublicEvents(projectId: string, mode: 'upcoming' | 'past') {
  const supabase = createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const query = supabase
    .from('events')
    .select('id, title, slug, description, cover_image_url, category, starts_at, ends_at, timezone, location_type, venue_name, total_capacity, registration_enabled, registration_opens_at, registration_closes_at, recording_url')
    .eq('project_id', projectId)
    .eq('status', 'published')
    .eq('visibility', 'public');

  if (mode === 'upcoming') {
    query.gte('starts_at', cutoff.toISOString()).order('starts_at', { ascending: true }).limit(200);
  } else {
    query.lt('starts_at', cutoff.toISOString()).order('starts_at', { ascending: false }).limit(50);
  }

  const { data: events } = await query;

  if (!events || events.length === 0) return [];

  // Fetch registration counts and sample names for social proof
  const eventIds = events.map(e => e.id);
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('event_id, registrant_name')
    .in('event_id', eventIds)
    .in('status', ['confirmed', 'pending_approval', 'pending_waiver'])
    .order('created_at', { ascending: false });

  const regMap = new Map<string, { count: number; names: string[] }>();
  for (const reg of registrations ?? []) {
    const entry = regMap.get(reg.event_id) ?? { count: 0, names: [] };
    entry.count++;
    if (entry.names.length < 5) entry.names.push(reg.registrant_name);
    regMap.set(reg.event_id, entry);
  }

  return events.map(e => {
    const reg = regMap.get(e.id);
    return {
      ...e,
      attendee_count: reg?.count ?? 0,
      attendee_names: reg?.names ?? [],
    };
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { calendarSlug } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('event_calendar_settings')
    .select('title, description')
    .eq('slug', calendarSlug)
    .eq('is_enabled', true)
    .single();

  return {
    title: data?.title ?? 'Events',
    description: data?.description ?? 'Browse upcoming events',
  };
}

export default async function PublicCalendarPage({ params }: PageProps) {
  const { calendarSlug } = await params;
  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from('event_calendar_settings')
    .select('*')
    .eq('slug', calendarSlug)
    .eq('is_enabled', true)
    .single();

  if (!settings) notFound();
  const [events, pastEvents] = await Promise.all([
    loadPublicEvents(settings.project_id, 'upcoming'),
    loadPublicEvents(settings.project_id, 'past'),
  ]);

  return (
    <div>
      <div className="mb-8">
        {settings.logo_url && (
          <div className="flex justify-center mb-4">
            <img src={settings.logo_url} alt="" className="h-12 w-auto" />
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold text-center">{settings.title}</h1>
        {settings.description && <p className="mt-3 text-center text-muted-foreground max-w-2xl mx-auto">{settings.description}</p>}
      </div>
      <PublicEventList events={events} pastEvents={pastEvents} calendarSlug={calendarSlug} />
    </div>
  );
}
