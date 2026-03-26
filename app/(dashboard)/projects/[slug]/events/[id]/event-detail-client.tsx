'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Copy, Download, ExternalLink, MapPin, Monitor, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { EventCoverUpload } from '@/components/community/events/tabs/event-cover-upload';
import { EventEditTab } from '@/components/community/events/tabs/event-edit-tab';
import { EventTicketTypesTab } from '@/components/community/events/tabs/event-ticket-types-tab';
import { EventRegistrationsTab } from '@/components/community/events/tabs/event-registrations-tab';
import { EventCheckInTab } from '@/components/community/events/tabs/event-check-in-tab';
import { EventAttendanceTab } from '@/components/community/events/tabs/event-attendance-tab';
import { EventNotesTab } from '@/components/community/events/tabs/event-notes-tab';
import { EventWaiversTab } from '@/components/community/events/tabs/event-waivers-tab';
import { EventDetailReportView } from '@/components/community/reports/event-detail-report';
import type { IndividualEventReport } from '@/lib/community/reports';

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
  cover_image_url: string | null;
  registration_count: number;
  registration_row_count?: number;
  registration_status_counts: {
    confirmed: number;
    waitlisted: number;
    pending_approval: number;
    pending_waiver: number;
    cancelled: number;
  };
  ticket_types: { id: string; name: string; description: string | null; quantity_available: number | null; max_per_order: number; is_active: boolean; sort_order: number }[];
  waiver_count?: number;
  [key: string]: unknown;
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
  const [isLoading, setIsLoading] = useState(true);
  const [calendarSlug, setCalendarSlug] = useState<string | null>(null);
  const [reportData, setReportData] = useState<IndividualEventReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const loadEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/events/${eventId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvent(data.event);
      setReportData(null);
      setReportLoaded(false); // Reset so report re-fetches on next tab click
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [slug, eventId]);

  useEffect(() => { void loadEvent(); }, [loadEvent]);

  const loadReport = useCallback(async () => {
    if (reportLoaded) return;
    setReportLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/community/reports?type=event_detail&eventId=${eventId}`);
      const json = await res.json() as { event_detail?: IndividualEventReport; error?: string };
      if (!res.ok) {
        setReportData(null);
        setReportLoaded(false);
        toast.error(json.error ?? 'Failed to load report');
      } else {
        setReportData(json.event_detail ?? null);
        setReportLoaded(true);
      }
    } catch {
      toast.error('Failed to load report');
      setReportData(null);
      setReportLoaded(false);
    } finally {
      setReportLoading(false);
    }
  }, [slug, eventId, reportLoaded]);

  // Load calendar slug for public link
  useEffect(() => {
    fetch(`/api/projects/${slug}/events/calendar-settings`)
      .then(res => res.json())
      .then(data => { if (data.settings?.slug) setCalendarSlug(data.settings.slug); })
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'report' && !reportLoaded && !reportLoading) {
      void loadReport();
    }
  }, [activeTab, reportLoaded, reportLoading, loadReport]);

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
        <div className="flex items-center gap-2 flex-wrap">
          {event.status === 'published' && calendarSlug && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/events/${calendarSlug}/${event.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />View Public Page
              </a>
            </Button>
          )}
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="registrations">Registrations ({event.registration_row_count ?? event.registration_count})</TabsTrigger>
          <TabsTrigger value="ticket-types">Tickets ({event.ticket_types.length})</TabsTrigger>
          <TabsTrigger value="check-in">Check-in</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="waivers">Waivers{event.waiver_count ? ` (${event.waiver_count})` : ''}</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          {/* Cover image */}
          <EventCoverUpload
            projectSlug={slug}
            eventId={eventId}
            currentUrl={event.cover_image_url}
            onUploaded={() => void loadEvent()}
          />

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

        <TabsContent value="edit" className="mt-4">
          <EventEditTab projectSlug={slug} eventId={eventId} event={event} onUpdated={() => void loadEvent()} />
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <EventRegistrationsTab projectSlug={slug} eventId={eventId} />
        </TabsContent>

        <TabsContent value="ticket-types" className="mt-4">
          <EventTicketTypesTab projectSlug={slug} eventId={eventId} ticketTypes={event.ticket_types} onUpdated={() => void loadEvent()} />
        </TabsContent>

        <TabsContent value="check-in" className="mt-4">
          <EventCheckInTab projectSlug={slug} eventId={eventId} />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <EventAttendanceTab projectSlug={slug} eventId={eventId} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <EventNotesTab projectSlug={slug} eventId={eventId} />
        </TabsContent>

        <TabsContent value="waivers" className="mt-4">
          <EventWaiversTab projectSlug={slug} eventId={eventId} />
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          {reportLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            <EventDetailReportView data={reportData} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
