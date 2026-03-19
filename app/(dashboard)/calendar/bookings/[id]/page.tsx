'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { Booking, EventType, BookingStatus, LocationType } from '@/types/calendar';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<(Booking & { event_types: EventType | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/calendar/bookings/${params.id}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBooking(data.booking);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

  const handleCancel = async () => {
    if (!booking || !confirm('Are you sure you want to cancel this booking?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/calendar/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        setBooking((b) => (b ? { ...b, status: 'cancelled', cancelled_by: 'host' } : b));
      }
    } catch {
      // Silently fail
    } finally {
      setCancelling(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!booking) return;
    try {
      const res = await fetch(`/api/calendar/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (res.ok) {
        setBooking((b) => (b ? { ...b, status: 'completed' } : b));
      }
    } catch {
      // Silently fail
    }
  };

  const handleNoShow = async () => {
    if (!booking) return;
    try {
      const res = await fetch(`/api/calendar/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'no_show' }),
      });
      if (res.ok) {
        setBooking((b) => (b ? { ...b, status: 'no_show' } : b));
      }
    } catch {
      // Silently fail
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!booking) return <div className="p-6 text-muted-foreground">Booking not found</div>;

  const et = booking.event_types;
  const isActive = booking.status === 'confirmed' || booking.status === 'pending';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <Badge className={BOOKING_STATUS_COLORS[booking.status as BookingStatus]}>
          {BOOKING_STATUS_LABELS[booking.status as BookingStatus]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{et?.title || 'Meeting'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Invitee</p>
              <p className="font-medium">{booking.invitee_name}</p>
              <p className="text-sm">{booking.invitee_email}</p>
              {booking.invitee_phone && <p className="text-sm">{booking.invitee_phone}</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">When</p>
              <p className="font-medium">
                {new Date(booking.start_at).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {et?.duration_minutes || 30} minutes
              </p>
            </div>
          </div>

          {(booking.location || booking.meeting_url) && (
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p>{booking.location || booking.meeting_url}</p>
              {et?.location_type && (
                <p className="text-sm text-muted-foreground">
                  {LOCATION_TYPE_LABELS[et.location_type as LocationType]}
                </p>
              )}
            </div>
          )}

          {booking.invitee_notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p>{booking.invitee_notes}</p>
            </div>
          )}

          {booking.cancellation_reason && (
            <div>
              <p className="text-sm text-muted-foreground">Cancellation Reason</p>
              <p>{booking.cancellation_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isActive && (
        <div className="flex gap-3">
          <Button onClick={handleMarkComplete}>Mark Complete</Button>
          <Button variant="outline" onClick={handleNoShow}>No Show</Button>
          <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Cancel Booking'}
          </Button>
        </div>
      )}

      <Button variant="ghost" onClick={() => router.push('/calendar/bookings')}>
        &larr; Back to Bookings
      </Button>
    </div>
  );
}
