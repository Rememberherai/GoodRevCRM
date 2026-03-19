'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '@/types/calendar';
import type { BookingStatus } from '@/types/calendar';
import { useCalendarContext } from '../calendar-context';

interface BookingItem {
  id: string;
  invitee_name: string;
  invitee_email: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  event_types: { title: string; color: string } | null;
}

type FilterTab = 'all' | 'upcoming' | 'pending' | 'completed' | 'cancelled';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { selectedProjectId } = useCalendarContext();

  useEffect(() => {
    let cancelled = false;
    async function loadBookings() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '50' });

        // For 'upcoming', we fetch confirmed bookings; for specific statuses, filter by status
        if (activeFilter === 'upcoming') {
          params.set('status', 'confirmed');
        } else if (activeFilter !== 'all') {
          params.set('status', activeFilter);
        }

        if (selectedProjectId) params.set('project_id', selectedProjectId);

        const res = await fetch(`/api/calendar/bookings?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          let results: BookingItem[] = data.bookings || [];

          // For 'upcoming', further filter to only future bookings
          if (activeFilter === 'upcoming') {
            const now = new Date();
            results = results.filter((b) => new Date(b.start_at) > now);
          }

          setBookings(results);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBookings();
    return () => { cancelled = true; };
  }, [activeFilter, selectedProjectId]);

  const filterTitle = activeFilter === 'all'
    ? 'All Bookings'
    : activeFilter === 'upcoming'
    ? 'Upcoming Bookings'
    : BOOKING_STATUS_LABELS[activeFilter as BookingStatus] || activeFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeFilter === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filterTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-muted-foreground">No bookings found.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/calendar/bookings/${booking.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-10 rounded-full"
                      style={{ backgroundColor: booking.event_types?.color || '#3b82f6' }}
                    />
                    <div>
                      <p className="font-medium">{booking.invitee_name}</p>
                      <p className="text-sm text-muted-foreground">{booking.invitee_email}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.event_types?.title} &middot;{' '}
                        {new Date(booking.start_at).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={BOOKING_STATUS_COLORS[booking.status] || ''}
                    variant="secondary"
                  >
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
