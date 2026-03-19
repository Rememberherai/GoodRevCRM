'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, XCircle, AlertCircle, Plus } from 'lucide-react';
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
  const [allBookings, setAllBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedProjectId } = useCalendarContext();

  useEffect(() => {
    let cancelled = false;
    async function loadBookings() {
      setLoading(true);
      try {
        // Fetch all bookings (no status filter) to compute stats
        const params = new URLSearchParams({ limit: '100' });
        if (selectedProjectId) params.set('project_id', selectedProjectId);
        const res = await fetch(`/api/calendar/bookings?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAllBookings(data.bookings || []);
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

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const upcoming = allBookings.filter(
      (b) => b.status === 'confirmed' && new Date(b.start_at) > now
    );

    const thisMonthBookings = allBookings.filter(
      (b) => new Date(b.start_at) >= monthStart
    );

    const completedThisMonth = thisMonthBookings.filter(
      (b) => b.status === 'completed'
    ).length;

    const cancelledThisMonth = thisMonthBookings.filter(
      (b) => b.status === 'cancelled'
    ).length;

    const confirmedThisMonth = thisMonthBookings.filter(
      (b) => b.status === 'confirmed'
    ).length;

    const denominator = cancelledThisMonth + completedThisMonth + confirmedThisMonth;
    const cancellationRate = denominator > 0
      ? Math.round((cancelledThisMonth / denominator) * 100)
      : 0;

    const pending = allBookings.filter((b) => b.status === 'pending');

    return {
      upcomingCount: upcoming.length,
      completedThisMonth,
      cancellationRate,
      pendingCount: pending.length,
    };
  }, [allBookings]);

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return allBookings
      .filter((b) => b.status === 'confirmed' && new Date(b.start_at) > now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 10);
  }, [allBookings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button asChild>
          <Link href="/calendar/event-types/new">
            <Plus className="h-4 w-4 mr-2" />
            New Event Type
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '\u2014' : stats.upcomingCount}</div>
            <p className="text-xs text-muted-foreground">confirmed &amp; future</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Month</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '\u2014' : stats.completedThisMonth}</div>
            <p className="text-xs text-muted-foreground">bookings completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancellation Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '\u2014' : `${stats.cancellationRate}%`}</div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Confirmation</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '\u2014' : stats.pendingCount}</div>
            <p className="text-xs text-muted-foreground">awaiting confirmation</p>
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
