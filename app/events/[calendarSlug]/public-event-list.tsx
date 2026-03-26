'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, Monitor } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location_type: string;
  venue_name: string | null;
  total_capacity: number | null;
  registration_enabled: boolean;
}

interface Props {
  events: PublicEvent[];
  calendarSlug: string;
}

export function PublicEventList({ events, calendarSlug }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">No upcoming events</h3>
        <p className="mt-1 text-sm text-muted-foreground">Check back later for new events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <Link key={event.id} href={`/events/${calendarSlug}/${event.slug}`}>
          <Card className="transition-shadow hover:shadow-md overflow-hidden">
            <div className="flex">
              {event.cover_image_url && (
                <div className="hidden sm:block w-48 flex-shrink-0">
                  <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <CardContent className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(event.starts_at).toLocaleDateString('en-US', {
                        timeZone: event.timezone || 'America/Denver',
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {event.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                    )}
                  </div>
                  {event.category && <Badge variant="outline">{event.category}</Badge>}
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  {event.location_type === 'virtual' ? (
                    <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />Virtual</span>
                  ) : event.venue_name ? (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue_name}</span>
                  ) : null}
                  {event.registration_enabled && (
                    <Badge variant="secondary" className="text-xs">Registration Open</Badge>
                  )}
                </div>
              </CardContent>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
