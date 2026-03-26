import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PublicEventList } from '@/app/events/[calendarSlug]/public-event-list';

interface PageProps {
  params: Promise<{ calendarSlug: string }>;
}

async function loadEmbedEvents(projectId: string) {
  const supabase = createServiceClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);

  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, description, cover_image_url, category, starts_at, ends_at, timezone, location_type, venue_name, total_capacity, registration_enabled, registration_opens_at, registration_closes_at')
    .eq('project_id', projectId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .gte('starts_at', cutoff.toISOString())
    .order('starts_at', { ascending: true })
    .limit(200);

  return events ?? [];
}

export default async function EmbeddedCalendarPage({ params }: PageProps) {
  const { calendarSlug } = await params;
  const supabase = createServiceClient();

  const { data: settings } = await supabase
    .from('event_calendar_settings')
    .select('project_id, title, description')
    .eq('slug', calendarSlug)
    .eq('is_enabled', true)
    .single();

  if (!settings) notFound();

  const events = await loadEmbedEvents(settings.project_id);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{settings.title}</h1>
        {settings.description && (
          <p className="mt-1 text-sm text-muted-foreground">{settings.description}</p>
        )}
      </div>
      <PublicEventList events={events} calendarSlug={calendarSlug} basePath={`/events/embed/${calendarSlug}`} />
    </div>
  );
}
