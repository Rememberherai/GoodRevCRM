'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Copy, Download, MapPin, Monitor, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface EventDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  category: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location_type: string;
  venue_name: string | null;
  venue_address: string | null;
  virtual_url: string | null;
  total_capacity: number | null;
  registration_enabled: boolean;
  waitlist_enabled: boolean;
  organizer_name: string | null;
  organizer_email: string | null;
  series_id: string | null;
  program_id: string | null;
  add_to_crm: boolean;
  registration_count: number;
  registration_row_count?: number;
  registration_status_counts: {
    confirmed: number;
    waitlisted: number;
    pending_approval: number;
    pending_waiver: number;
    cancelled: number;
  };
  ticket_types: TicketType[];
}

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  quantity_available: number | null;
  max_per_order: number;
  is_active: boolean;
}

interface Registration {
  id: string;
  registrant_name: string;
  registrant_email: string;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  event_registration_tickets: { id: string; qr_code: string | null }[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  published: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
};

export function EventDetailClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regLoading, setRegLoading] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/events/${eventId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvent(data.event);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [slug, eventId]);

  const loadRegistrations = useCallback(async () => {
    setRegLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/events/${eventId}/registrations?limit=100`);
      const data = await res.json();
      if (res.ok) setRegistrations(data.registrations ?? []);
    } catch (err) { console.error('Failed to load registrations:', err); } finally {
      setRegLoading(false);
    }
  }, [slug, eventId]);

  useEffect(() => { void loadEvent(); }, [loadEvent]);

  async function handlePublish() {
    const targetStatus = event?.status === 'published' ? 'draft' : 'published';
    try {
      const res = await fetch(`/api/projects/${slug}/events/${eventId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(targetStatus === 'published' ? 'Event published' : 'Reverted to draft');
      void loadEvent();
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleDuplicate() {
    try {
      const res = await fetch(`/api/projects/${slug}/events/${eventId}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Event duplicated');
      router.push(`/projects/${slug}/events/${data.event.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      const res = await fetch(`/api/projects/${slug}/events/${eventId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Event deleted');
      router.push(`/projects/${slug}/events`);
    } catch {
      toast.error('Failed to delete');
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      timeZone: event?.timezone || 'America/Denver',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-64 bg-muted rounded" /><div className="h-40 bg-muted rounded-xl" /></div>;
  if (!event) return <div className="text-center py-12 text-muted-foreground">Event not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${slug}/events`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{event.title}</h2>
              <Badge className={statusColors[event.status] ?? ''}>{event.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(event.starts_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePublish}>
            {event.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-1 h-3 w-3" />Duplicate
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/projects/${slug}/events/${eventId}/export`} download>
              <Download className="mr-1 h-3 w-3" />Export CSV
            </a>
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 h-3 w-3" />Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" onValueChange={(v) => { if (v === 'registrations') void loadRegistrations(); }}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="registrations">Registrations ({event.registration_row_count ?? event.registration_count})</TabsTrigger>
          <TabsTrigger value="ticket-types">Ticket Types ({event.ticket_types.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Event Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {event.description && <p className="text-muted-foreground">{event.description}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Start:</span>
                    <p>{formatDate(event.starts_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End:</span>
                    <p>{formatDate(event.ends_at)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>
                    <p className="flex items-center gap-1">
                      {event.location_type === 'virtual' ? <><Monitor className="h-3 w-3" />Virtual</> : <><MapPin className="h-3 w-3" />{event.venue_name ?? 'TBD'}</>}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p>{event.category ?? 'None'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Registration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Confirmed</span><span className="font-medium">{event.registration_status_counts.confirmed}</span></div>
                  <div className="flex justify-between"><span>Waitlisted</span><span className="font-medium">{event.registration_status_counts.waitlisted}</span></div>
                  <div className="flex justify-between"><span>Pending Approval</span><span className="font-medium">{event.registration_status_counts.pending_approval}</span></div>
                  {event.registration_status_counts.pending_waiver > 0 && (
                    <div className="flex justify-between"><span>Pending Waiver</span><span className="font-medium">{event.registration_status_counts.pending_waiver}</span></div>
                  )}
                  <div className="flex justify-between"><span>Capacity</span><span className="font-medium">{event.total_capacity ?? 'Unlimited'}</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" />Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Registration</span><Badge variant={event.registration_enabled ? 'default' : 'secondary'}>{event.registration_enabled ? 'Open' : 'Closed'}</Badge></div>
                  <div className="flex justify-between"><span>Waitlist</span><span>{event.waitlist_enabled ? 'Enabled' : 'Disabled'}</span></div>
                  <div className="flex justify-between"><span>Add to CRM</span><span>{event.add_to_crm ? 'Yes' : 'No'}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrations</CardTitle>
              <CardDescription>All registrations for this event.</CardDescription>
            </CardHeader>
            <CardContent>
              {regLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
              ) : registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No registrations yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-2 text-left font-medium">Name</th>
                        <th className="px-2 py-2 text-left font-medium">Email</th>
                        <th className="px-2 py-2 text-left font-medium">Status</th>
                        <th className="px-2 py-2 text-left font-medium">Checked In</th>
                        <th className="px-2 py-2 text-left font-medium">Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((reg) => (
                        <tr key={reg.id} className="border-b last:border-0">
                          <td className="px-2 py-2">{reg.registrant_name}</td>
                          <td className="px-2 py-2 text-muted-foreground">{reg.registrant_email}</td>
                          <td className="px-2 py-2"><Badge variant="secondary">{reg.status}</Badge></td>
                          <td className="px-2 py-2">{reg.checked_in_at ? new Date(reg.checked_in_at).toLocaleString() : '-'}</td>
                          <td className="px-2 py-2 text-muted-foreground">{new Date(reg.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ticket-types" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Types</CardTitle>
              <CardDescription>Manage ticket tiers for this event.</CardDescription>
            </CardHeader>
            <CardContent>
              {event.ticket_types.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No ticket types configured. A default &ldquo;General Admission&rdquo; ticket will be used.</p>
              ) : (
                <div className="space-y-3">
                  {event.ticket_types.map((tt) => (
                    <div key={tt.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{tt.name}</p>
                        {tt.description && <p className="text-xs text-muted-foreground">{tt.description}</p>}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Limit: {tt.quantity_available ?? 'Unlimited'}</span>
                        <span>Max/order: {tt.max_per_order}</span>
                        <Badge variant={tt.is_active ? 'default' : 'secondary'}>{tt.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
