'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BookingRecord {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  invitee_name: string;
  invitee_email: string;
  event_type_id: string;
}

export function AssetCalendar({ assetId }: { assetId: string }) {
  const params = useParams();
  const slug = params.slug as string;
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [inviteeName, setInviteeName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadBookings = useCallback(async () => {
    const response = await fetch(`/api/projects/${slug}/community-assets/${assetId}/bookings`);
    const data = await response.json() as { bookings?: BookingRecord[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to load bookings');
    }
    setBookings(data.bookings ?? []);
  }, [assetId, slug]);

  useEffect(() => {
    void loadBookings().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load bookings');
    });
  }, [loadBookings]);

  const groupedBookings = useMemo(() => {
    const now = new Date();
    const days = view === 'day' ? 1 : view === 'week' ? 7 : 31;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    return bookings
      .filter((booking) => new Date(booking.start_at) <= cutoff)
      .reduce<Record<string, BookingRecord[]>>((groups, booking) => {
        const key = new Date(booking.start_at).toLocaleDateString();
        groups[key] = groups[key] ?? [];
        groups[key].push(booking);
        return groups;
      }, {});
  }, [bookings, view]);

  async function handleCreate() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${slug}/community-assets/${assetId}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          start_at: startAt,
          end_at: endAt,
          invitee_name: inviteeName,
          invitee_email: inviteeEmail,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to create booking');
      }
      setOpen(false);
      setTitle('');
      setStartAt('');
      setEndAt('');
      setInviteeName('');
      setInviteeEmail('');
      await loadBookings();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create booking');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Booking Calendar
          </CardTitle>
          <CardDescription>Review scheduled uses of this asset and add new bookings.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(next) => setView(next as 'day' | 'week' | 'month')}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Booking
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {Object.keys(groupedBookings).length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No bookings in the selected time window.
          </div>
        ) : (
          Object.entries(groupedBookings).map(([day, dayBookings]) => (
            <div key={day} className="rounded-lg border p-4">
              <div className="mb-3 font-medium">{day}</div>
              <div className="space-y-2">
                {dayBookings.map((booking) => (
                  <div key={booking.id} className="rounded-md bg-muted/40 p-3 text-sm">
                    <div className="font-medium">{booking.invitee_name}</div>
                    <div className="text-muted-foreground">
                      {new Date(booking.start_at).toLocaleTimeString()} to {new Date(booking.end_at).toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{booking.invitee_email}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Booking</DialogTitle>
            <DialogDescription>Create a reservation for this community asset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Invitee Name</Label>
                <Input value={inviteeName} onChange={(event) => setInviteeName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Invitee Email</Label>
                <Input value={inviteeEmail} onChange={(event) => setInviteeEmail(event.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={isSaving || !startAt || !endAt || !inviteeName || !inviteeEmail}>
              Save Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
