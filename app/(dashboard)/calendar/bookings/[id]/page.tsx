'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS, LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { Booking, EventType, BookingStatus, LocationType } from '@/types/calendar';
import Link from 'next/link';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<(Booking & { event_types: EventType | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/bookings/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setBooking(data.booking);
        setError(null);
      } else if (res.status === 404) {
        setBooking(null);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || `Failed to load booking (${res.status})`);
      }
    } catch {
      setError('Network error loading booking. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleStatusChange = async (newStatus: string, confirmMessage?: string) => {
    if (!booking) return;
    if (confirmMessage && !confirm(confirmMessage)) return;
    setActionLoading(newStatus);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await loadBooking();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || `Failed to update booking status to ${newStatus}`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!booking && error) return (
    <div className="p-6 space-y-4">
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
        {error}
      </div>
      <Button type="button" variant="ghost" onClick={() => router.push('/calendar/bookings')}>
        &larr; Back to Bookings
      </Button>
    </div>
  );
  if (!booking) return <div className="p-6 text-muted-foreground">Booking not found</div>;

  const et = booking.event_types;
  const status = booking.status as BookingStatus;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Booking Details</h1>
        <Badge className={BOOKING_STATUS_COLORS[status]}>
          {BOOKING_STATUS_LABELS[status]}
        </Badge>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

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

          {/* CRM Links */}
          {(booking.person_id || booking.meeting_id) && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">CRM Links</p>
              {booking.person_id && (
                <div>
                  <Link
                    href={`/contacts/${booking.person_id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Linked Contact: {booking.person_id}
                  </Link>
                </div>
              )}
              {booking.meeting_id && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Linked Meeting</Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons based on status */}
      <div className="flex flex-wrap gap-3">
        {status === 'pending' && (
          <Button
            type="button"
            onClick={() => handleStatusChange('confirmed')}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'confirmed' ? 'Confirming...' : 'Confirm Booking'}
          </Button>
        )}

        {status === 'confirmed' && (
          <>
            <Button
              type="button"
              onClick={() => handleStatusChange('completed')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'completed' ? 'Completing...' : 'Mark Complete'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleStatusChange('no_show')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'no_show' ? 'Updating...' : 'Mark No-Show'}
            </Button>
          </>
        )}

        {(status === 'confirmed' || status === 'pending') && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleStatusChange('cancelled', 'Are you sure you want to cancel this booking?')}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'cancelled' ? 'Cancelling...' : 'Cancel Booking'}
          </Button>
        )}
      </div>

      <Button type="button" variant="ghost" onClick={() => router.push('/calendar/bookings')}>
        &larr; Back to Bookings
      </Button>
    </div>
  );
}
