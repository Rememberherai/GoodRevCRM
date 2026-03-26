import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicEventList } from './public-event-list';

interface PageProps {
  params: Promise<{ calendarSlug: string }>;
}

async function loadRecentPublicEvents(projectId: string) {
  const supabase = createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, description, cover_image_url, category, starts_at, ends_at, timezone, location_type, venue_name, total_capacity, registration_enabled')
    .eq('project_id', projectId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .gte('starts_at', cutoff.toISOString())
    .order('starts_at', { ascending: true })
    .limit(200);

  return events ?? [];
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
  const events = await loadRecentPublicEvents(settings.project_id);

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{settings.title}</h1>
        {settings.description && <p className="mt-2 text-muted-foreground">{settings.description}</p>}
      </div>
      <PublicEventList events={events} calendarSlug={calendarSlug} />
    </div>
  );
}
