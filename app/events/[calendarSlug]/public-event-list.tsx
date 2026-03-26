'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Monitor, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
}

interface Props {
  events: PublicEvent[];
  calendarSlug: string;
  basePath?: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PublicEventList({ events, calendarSlug, basePath }: Props) {
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Build set of dates that have events
  const eventDates = useMemo(() => {
    const dates = new Map<string, number>();
    for (const event of events) {
      const d = new Date(event.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      dates.set(key, (dates.get(key) ?? 0) + 1);
    }
    return dates;
  }, [events]);

  // Filter events by selected date or show all
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return events;
    return events.filter(event => {
      const d = new Date(event.starts_at);
      return isSameDay(d, selectedDate);
    });
  }, [events, selectedDate]);

  // Group events by month
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: PublicEvent[] }[] = [];
    let currentLabel = '';
    let currentGroup: PublicEvent[] = [];

    for (const event of filteredEvents) {
      const d = new Date(event.starts_at);
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (label !== currentLabel) {
        if (currentGroup.length > 0) {
          groups.push({ label: currentLabel, events: currentGroup });
        }
        currentLabel = label;
        currentGroup = [event];
      } else {
        currentGroup.push(event);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ label: currentLabel, events: currentGroup });
    }
    return groups;
  }, [filteredEvents]);

  // Calendar rendering
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  function handleDayClick(day: number) {
    const clicked = new Date(calYear, calMonth, day);
    if (selectedDate && isSameDay(selectedDate, clicked)) {
      setSelectedDate(null); // toggle off
    } else {
      setSelectedDate(clicked);
    }
  }

  function formatTime(iso: string, tz: string) {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: tz || 'America/Denver',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatDayDate(iso: string, tz: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      timeZone: tz || 'America/Denver',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold">No upcoming events</h3>
        <p className="mt-2 text-muted-foreground max-w-sm">There are no events scheduled at this time. Check back later for updates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mini Calendar */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-semibold">{MONTH_NAMES[calMonth]} {calYear}</h3>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-7 gap-0">
              {DAY_HEADERS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = `${calYear}-${calMonth}-${day}`;
                const count = eventDates.get(key) ?? 0;
                const isToday = isSameDay(new Date(calYear, calMonth, day), now);
                const isSelected = selectedDate && isSameDay(new Date(calYear, calMonth, day), selectedDate);

                return (
                  <button
                    key={day}
                    onClick={() => count > 0 ? handleDayClick(day) : undefined}
                    className={`
                      relative flex flex-col items-center justify-center py-1.5 text-sm rounded-lg transition-colors
                      ${count > 0 ? 'cursor-pointer hover:bg-primary/10 font-medium' : 'cursor-default text-muted-foreground/60'}
                      ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                      ${isToday && !isSelected ? 'ring-1 ring-primary/50' : ''}
                    `}
                  >
                    {day}
                    {count > 0 && !isSelected && (
                      <span className="absolute bottom-0.5 flex gap-0.5">
                        {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                          <span key={j} className="h-1 w-1 rounded-full bg-primary" />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {selectedDate && (
            <div className="px-4 pb-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs w-full"
                onClick={() => setSelectedDate(null)}
              >
                Show all events
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event list */}
      <div className="space-y-8">
        {groupedEvents.map(group => (
          <div key={group.label}>
            <h3 className="text-lg font-semibold text-foreground mb-4 sticky top-0 bg-gray-50 dark:bg-gray-950 py-2 z-10">
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.events.map((event) => {
                const regOpen = event.registration_enabled &&
                  (!event.registration_opens_at || new Date(event.registration_opens_at) <= now) &&
                  (!event.registration_closes_at || new Date(event.registration_closes_at) >= now);

                return (
                  <Link key={event.id} href={`${basePath ?? `/events/${calendarSlug}`}/${event.slug}`} className="block group">
                    <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-border/60">
                      <div className="flex">
                        {/* Date column */}
                        <div className="hidden sm:flex flex-col items-center justify-center w-24 flex-shrink-0 bg-primary/5 border-r px-2 py-4">
                          <span className="text-xs font-medium text-primary uppercase">
                            {new Date(event.starts_at).toLocaleDateString('en-US', {
                              timeZone: event.timezone || 'America/Denver',
                              month: 'short',
                            })}
                          </span>
                          <span className="text-2xl font-bold text-foreground leading-tight">
                            {new Date(event.starts_at).toLocaleDateString('en-US', {
                              timeZone: event.timezone || 'America/Denver',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.starts_at).toLocaleDateString('en-US', {
                              timeZone: event.timezone || 'America/Denver',
                              weekday: 'short',
                            })}
                          </span>
                        </div>

                        {/* Cover image */}
                        {event.cover_image_url && (
                          <div className="hidden md:block w-44 flex-shrink-0">
                            <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}

                        {/* Content */}
                        <CardContent className="flex-1 p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {/* Mobile date */}
                              <p className="text-xs font-medium text-primary uppercase sm:hidden mb-1">
                                {formatDayDate(event.starts_at, event.timezone)}
                              </p>
                              <h3 className="text-base sm:text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                                {event.title}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{formatTime(event.starts_at, event.timezone)} – {formatTime(event.ends_at, event.timezone)}</span>
                              </div>
                              {event.description && (
                                <p className="mt-2 text-sm text-muted-foreground line-clamp-2 hidden sm:block">{event.description}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              {event.category && <Badge variant="outline" className="text-xs">{event.category}</Badge>}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                            {event.location_type === 'virtual' ? (
                              <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />Virtual</span>
                            ) : event.venue_name ? (
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.venue_name}</span>
                            ) : null}
                            {regOpen && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0 text-xs">
                                Registration Open
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
