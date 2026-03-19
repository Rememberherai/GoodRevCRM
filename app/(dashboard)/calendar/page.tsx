'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, Users, Plus } from 'lucide-react';
import Link from 'next/link';
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/types/calendar';
import type { BookingStatus } from '@/types/calendar';
import { useCalendarContext } from './calendar-context';

interface BookingItem {
  id: string;
  invitee_name: string;
  invitee_email: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  event_types: { title: string; color: string; duration_minutes: number } | null;
}

export default function CalendarDashboardPage() {
  const [upcomingBookings, setUpcomingBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedProjectId } = useCalendarContext();

  useEffect(() => {
    let cancelled = false;
    async function loadBookings() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: 'confirmed', limit: '10' });
        if (selectedProjectId) params.set('project_id', selectedProjectId);
        const res = await fetch(`/api/calendar/bookings?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUpcomingBookings(data.bookings || []);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBookings();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Link href="/calendar/event-types/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Event Type
          </Button>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingBookings.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingBookings.filter((b) => {
                const today = new Date().toDateString();
                return new Date(b.start_at).toDateString() === today;
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingBookings.filter((b) => {
                const now = new Date();
                const weekEnd = new Date(now);
                weekEnd.setDate(now.getDate() + 7);
                const bookingDate = new Date(b.start_at);
                return bookingDate >= now && bookingDate <= weekEnd;
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming bookings list */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : upcomingBookings.length === 0 ? (
            <p className="text-muted-foreground">No upcoming bookings.</p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/calendar/bookings/${booking.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: booking.event_types?.color || '#3b82f6' }}
                    />
                    <div>
                      <p className="font-medium">{booking.invitee_name}</p>
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
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      BOOKING_STATUS_COLORS[booking.status] || ''
                    }`}
                  >
                    {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
