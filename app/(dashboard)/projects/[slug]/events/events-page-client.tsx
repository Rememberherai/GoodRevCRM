'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Plus, Repeat, Search, MapPin, Monitor, Settings2, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
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
  registration_count?: number;
  checked_in_count?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  postponed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
};

const DAY_NAMES: Record<string, string> = {
  MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
  FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
};

const POSITION_LABELS: Record<number, string> = {
  1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: 'Last',
};

function formatRecurrenceDescription(series: {
  recurrence_frequency: string;
  recurrence_days_of_week: string[] | null;
  recurrence_day_positions: number[] | null;
  recurrence_interval: number | null;
}): string {
  const days = series.recurrence_days_of_week ?? [];
  const positions = series.recurrence_day_positions ?? [];
  const dayNames = days.map(d => DAY_NAMES[d]).filter(Boolean);

  if (series.recurrence_frequency === 'monthly' && positions.length > 0 && dayNames.length > 0) {
    const posLabels = positions.map(p => POSITION_LABELS[p] ?? `${p}th`);
    return `${posLabels.join(' & ')} ${dayNames.join(', ')} of Each Month`;
  }

  if (series.recurrence_frequency === 'daily') {
    const interval = series.recurrence_interval ?? 1;
    return interval > 1 ? `Every ${interval} Days` : 'Daily';
  }

  if (series.recurrence_frequency === 'biweekly') {
    return dayNames.length > 0 ? `Every Other ${dayNames.join(', ')}` : 'Biweekly';
  }

  // weekly
  if (dayNames.length > 0) {
    const interval = series.recurrence_interval ?? 1;
    const prefix = interval > 1 ? `Every ${interval} Weeks on` : 'Every';
    return `${prefix} ${dayNames.join(', ')}`;
  }

  // fallback
  return series.recurrence_frequency.charAt(0).toUpperCase() + series.recurrence_frequency.slice(1);
}

const ITEMS_PER_PAGE = 24;

export function EventsPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<{ id: string; title: string; status: string; recurrence_frequency: string; recurrence_days_of_week: string[] | null; recurrence_day_positions: number[] | null; recurrence_interval: number | null; program_id: string | null; upcoming_event_count?: number }[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [calendarSlug, setCalendarSlug] = useState<string | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const loadEvents = useCallback(async (nextSearch: string, status: string, page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({ limit: String(ITEMS_PER_PAGE), page: String(page), sortBy: 'starts_at', sortOrder: 'asc' });
      if (nextSearch.trim()) searchParams.set('search', nextSearch.trim());
      if (status !== 'all') searchParams.set('status', status);
      // On the "all" tab, exclude events that belong to a series — series are shown as their own cards
      if (status === 'all') searchParams.set('excludeSeries', 'true');

      const response = await fetch(`/api/projects/${slug}/events?${searchParams.toString()}`);
      const data = await response.json() as { events?: EventListItem[]; pagination?: Pagination; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to load events');
      setEvents(data.events ?? []);
      if (data.pagination) setPagination(data.pagination);
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
    fetch(`/api/projects/${slug}/events/calendar-settings`)
      .then(res => res.json())
      .then(data => {
        if (data.settings?.is_enabled && data.settings?.slug) {
          setCalendarSlug(data.settings.slug);
        }
      })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (statusFilter === 'series') {
      void loadSeries();
    } else {
      void loadEvents(search, statusFilter, 1);
      if (statusFilter === 'all') void loadSeries();
    }
    // Exit select mode when changing filters
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [loadEvents, loadSeries, search, statusFilter]);

  function goToPage(page: number) {
    void loadEvents(search, statusFilter, page);
  }

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

  // Long press handlers for multi-select
  function handlePointerDown(eventId: string) {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (!selectMode) {
        setSelectMode(true);
        setSelectedIds(new Set([eventId]));
      } else {
        toggleSelection(eventId);
      }
    }, 500);
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Reset after a microtask so the click handler can still read it
    if (longPressTriggered.current) {
      requestAnimationFrame(() => { longPressTriggered.current = false; });
    }
  }

  function handlePointerLeave() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function toggleSelection(eventId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  function handleCardClick(e: React.MouseEvent, eventId: string) {
    if (longPressTriggered.current) {
      e.preventDefault();
      return;
    }
    if (selectMode) {
      e.preventDefault();
      toggleSelection(eventId);
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function selectAll() {
    setSelectedIds(new Set(events.map(e => e.id)));
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedIds.size} event${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${slug}/events/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete events');
      toast.success(`Deleted ${data.deleted} event${data.deleted > 1 ? 's' : ''}`);
      exitSelectMode();
      // If we deleted all items on the current page, go back one page
      const remainingOnPage = events.length - (data.deleted ?? 0);
      const targetPage = remainingOnPage <= 0 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      void loadEvents(search, statusFilter, targetPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete events');
    } finally {
      setIsDeleting(false);
    }
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

      {calendarSlug && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Public calendar:</span>
            <a
              href={`/events/${calendarSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {typeof window !== 'undefined' ? `${window.location.origin}/events/${calendarSlug}` : `/events/${calendarSlug}`}
            </a>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${window.location.origin}/events/${calendarSlug}`;
              navigator.clipboard.writeText(url);
            }}
          >
            Copy Link
          </Button>
        </div>
      )}

      {/* Select mode toolbar */}
      {selectMode && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={exitSelectMode} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
              Select All
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
          </Button>
        </div>
      )}

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
                          <span>{formatRecurrenceDescription(s)}</span>
                        </div>
                        {(s.upcoming_event_count ?? 0) > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {s.upcoming_event_count} upcoming event{s.upcoming_event_count === 1 ? '' : 's'}
                          </p>
                        )}
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
          ) : events.length === 0 && !(statusFilter === 'all' && seriesList.length > 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No events found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? 'Try a different search term.' : 'Create your first event to get started.'}
              </p>
            </div>
          ) : (
            <>
              {!selectMode && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Long press an event card to select multiple events for bulk actions.
                </p>
              )}
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
                          <span>{formatRecurrenceDescription(s)}</span>
                        </div>
                        {(s.upcoming_event_count ?? 0) > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {s.upcoming_event_count} upcoming event{s.upcoming_event_count === 1 ? '' : 's'}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {events.map((event) => {
                  const isSelected = selectedIds.has(event.id);
                  return (
                    <Link
                      key={event.id}
                      href={`/projects/${slug}/events/${event.id}`}
                      className="group"
                      onClick={(e) => handleCardClick(e, event.id)}
                      onPointerDown={() => handlePointerDown(event.id)}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerLeave}
                      draggable={false}
                    >
                      <Card className={`h-full transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''} ${selectMode ? 'select-none' : ''}`}>
                        {event.cover_image_url && (
                          <div className="h-32 overflow-hidden rounded-t-xl">
                            <img
                              src={event.cover_image_url}
                              alt={event.title}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            {selectMode && (
                              <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                                {isSelected && (
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <h3 className="flex-1 font-semibold leading-tight group-hover:text-primary">
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
                            {(event.registration_count ?? 0) > 0 && (
                              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.registration_count} reg</span>
                            )}
                            {(event.checked_in_count ?? 0) > 0 && (
                              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{event.checked_in_count} in</span>
                            )}
                            {event.total_capacity && (
                              <span className="flex items-center gap-1">Cap: {event.total_capacity}</span>
                            )}
                            {event.series_id && (
                              <Badge variant="outline" className="text-xs">Series</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} events
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={pagination.page <= 1}
                      onClick={() => goToPage(pagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: pagination.totalPages }).map((_, i) => {
                      const page = i + 1;
                      // Show first, last, current, and neighbors
                      if (page === 1 || page === pagination.totalPages || Math.abs(page - pagination.page) <= 1) {
                        return (
                          <Button
                            key={page}
                            variant={page === pagination.page ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      }
                      // Show ellipsis
                      if (page === 2 && pagination.page > 3) {
                        return <span key="start-ellipsis" className="px-1 text-muted-foreground">...</span>;
                      }
                      if (page === pagination.totalPages - 1 && pagination.page < pagination.totalPages - 2) {
                        return <span key="end-ellipsis" className="px-1 text-muted-foreground">...</span>;
                      }
                      return null;
                    })}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => goToPage(pagination.page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <NewEventDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectSlug={slug}
        onCreated={() => void loadEvents(search, statusFilter, pagination.page)}
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
