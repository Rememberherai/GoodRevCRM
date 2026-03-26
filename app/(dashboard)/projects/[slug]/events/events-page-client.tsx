'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, Plus, Repeat, Search, MapPin, Monitor, Settings2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewEventDialog } from '@/components/community/events/new-event-dialog';
import { NewSeriesDialog } from '@/components/community/events/new-series-dialog';

interface EventListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location_type: string;
  venue_name: string | null;
  total_capacity: number | null;
  registration_enabled: boolean;
  cover_image_url: string | null;
  series_id: string | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  postponed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
};

export function EventsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<{ id: string; title: string; status: string; recurrence_frequency: string; program_id: string | null }[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  const loadEvents = useCallback(async (nextSearch: string, status: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({ limit: '24', sortBy: 'starts_at', sortOrder: 'asc' });
      if (nextSearch.trim()) searchParams.set('search', nextSearch.trim());
      if (status !== 'all') searchParams.set('status', status);

      const response = await fetch(`/api/projects/${slug}/events?${searchParams.toString()}`);
      const data = await response.json() as { events?: EventListItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load events');
      setEvents(data.events ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  const loadSeries = useCallback(async () => {
    setSeriesLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/events/series?limit=50`);
      const data = await res.json();
      if (res.ok) setSeriesList(data.series ?? []);
    } catch {
      console.error('Failed to load series');
    } finally {
      setSeriesLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (statusFilter === 'series') {
      void loadSeries();
    } else {
      void loadEvents(search, statusFilter);
      if (statusFilter === 'all') void loadSeries();
    }
  }, [loadEvents, loadSeries, search, statusFilter]);

  function formatEventDate(startsAt: string, timezone: string) {
    return new Date(startsAt).toLocaleDateString('en-US', {
      timeZone: timezone || 'America/Denver',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Events</h2>
            <p className="text-sm text-muted-foreground">Manage events, registrations, and attendance.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${slug}/events/settings`}>
            <Button variant="outline" size="icon">
              <Settings2 className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setIsSeriesDialogOpen(true)}>
            <Repeat className="mr-2 h-4 w-4" />
            New Series
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Event Directory</CardTitle>
            <CardDescription>View and manage all events for this project.</CardDescription>
          </div>
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </form>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="series">Series</TabsTrigger>
            </TabsList>
          </Tabs>

          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          )}

          {statusFilter === 'series' ? (
            seriesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : seriesList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Repeat className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No series found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a recurring series to auto-generate events.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {seriesList.map(s => (
                  <Link key={s.id} href={`/projects/${slug}/events/series/${s.id}`} className="group">
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-tight group-hover:text-primary">{s.title}</h3>
                          <Badge variant="secondary" className={statusColors[s.status] ?? ''}>{s.status}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Repeat className="h-3 w-3" />
                          <span className="capitalize">{s.recurrence_frequency}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No events found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? 'Try a different search term.' : 'Create your first event to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {statusFilter === 'all' && seriesList.length > 0 && seriesList.map(s => (
                <Link key={`series-${s.id}`} href={`/projects/${slug}/events/series/${s.id}`} className="group">
                  <Card className="h-full transition-shadow hover:shadow-md border-dashed">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight group-hover:text-primary">{s.title}</h3>
                        <Badge variant="secondary" className={statusColors[s.status] ?? ''}>{s.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Repeat className="h-3 w-3" />
                        <span className="capitalize">{s.recurrence_frequency}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/projects/${slug}/events/${event.id}`}
                  className="group"
                >
                  <Card className="h-full transition-shadow hover:shadow-md">
                    {event.cover_image_url && (
                      <div className="h-32 overflow-hidden rounded-t-xl">
                        <img
                          src={event.cover_image_url}
                          alt={event.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-tight group-hover:text-primary">
                          {event.title}
                        </h3>
                        <Badge variant="secondary" className={statusColors[event.status] ?? ''}>
                          {event.status}
                        </Badge>
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">
                        {formatEventDate(event.starts_at, event.timezone)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {event.location_type === 'virtual' ? (
                          <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />Virtual</span>
                        ) : event.venue_name ? (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue_name}</span>
                        ) : null}
                        {event.total_capacity && (
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />Cap: {event.total_capacity}</span>
                        )}
                        {event.series_id && (
                          <Badge variant="outline" className="text-xs">Series</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewEventDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectSlug={slug}
        onCreated={() => void loadEvents(search, statusFilter)}
      />

      <NewSeriesDialog
        open={isSeriesDialogOpen}
        onOpenChange={setIsSeriesDialogOpen}
        projectSlug={slug}
        onCreated={() => { setStatusFilter('series'); void loadSeries(); }}
      />
    </div>
  );
}
