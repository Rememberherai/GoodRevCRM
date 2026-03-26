'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Monitor, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EventCardItem {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  location_type: string;
  venue_name: string | null;
  total_capacity: number | null;
  registration_count: number;
  status: string;
}

interface EventCardsProps {
  projectSlug: string;
}

export function EventCards({ projectSlug }: EventCardsProps) {
  const [events, setEvents] = useState<EventCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        const upcoming: Array<{ id: string; title: string; starts_at: string; timezone: string; location_type: string; venue_name: string | null; total_capacity: number | null; status: string }> = [];
        let page = 1;
        let totalPages = 1;
        const now = new Date();

        while (upcoming.length < 5 && page <= totalPages) {
          const listResponse = await fetch(
            `/api/projects/${projectSlug}/events?page=${page}&limit=25&sortBy=starts_at&sortOrder=asc&status=published`
          );
          if (!listResponse.ok) return;

          const listData = await listResponse.json() as {
            events?: Array<{ id: string; title: string; starts_at: string; timezone: string; location_type: string; venue_name: string | null; total_capacity: number | null; status: string }>;
            pagination?: { totalPages?: number };
          };

          totalPages = listData.pagination?.totalPages ?? page;
          upcoming.push(
            ...(listData.events ?? []).filter((event) => new Date(event.starts_at) >= now)
          );
          page += 1;
        }

        const withCounts = await Promise.all(upcoming.slice(0, 5).map(async (event) => {
          const detailResponse = await fetch(`/api/projects/${projectSlug}/events/${event.id}`);
          if (!detailResponse.ok) {
            return { ...event, registration_count: 0 };
          }

          const detailData = await detailResponse.json() as {
            event?: { registration_count?: number; registration_row_count?: number };
          };

          return {
            ...event,
            registration_count: detailData.event?.registration_row_count ?? detailData.event?.registration_count ?? 0,
          };
        }));

        setEvents(withCounts);
      } finally {
        setIsLoading(false);
      }
    }

    void loadEvents();
  }, [projectSlug]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Events</CardTitle>
        <CardDescription>Published events coming up next with live registration counts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No upcoming published events yet.
          </div>
        ) : (
          events.map((event) => (
            <Link
              key={event.id}
              href={`/projects/${projectSlug}/events/${event.id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{event.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(event.starts_at).toLocaleDateString('en-US', {
                      timeZone: event.timezone || 'America/Denver',
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <Badge variant="outline">{event.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {event.location_type === 'virtual' ? (
                  <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />Virtual</span>
                ) : event.venue_name ? (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue_name}</span>
                ) : null}
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.registration_count} registered</span>
                {event.total_capacity != null && <span>Capacity {event.total_capacity}</span>}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
