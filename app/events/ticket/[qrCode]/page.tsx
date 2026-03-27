import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CheckCircle2, CalendarDays, MapPin, Monitor, Ticket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TicketCheckInButton } from './ticket-check-in-button';

interface PageProps {
  params: Promise<{ qrCode: string }>;
}

export default async function TicketScanPage({ params }: PageProps) {
  const { qrCode } = await params;
  const supabase = createServiceClient();

  // Look up ticket by QR code
  const { data: ticket } = await supabase
    .from('event_registration_tickets')
    .select('id, qr_code, checked_in_at, attendee_name, registration_id, event_ticket_types(name)')
    .eq('qr_code', qrCode)
    .single();

  if (!ticket) notFound();

  const registrationId = ticket.registration_id;

  const { data: registration } = await supabase
    .from('event_registrations')
    .select('id, registrant_name, registrant_email, status, events(title, starts_at, ends_at, timezone, venue_name, location_type, virtual_url)')
    .eq('id', registrationId)
    .single();

  if (!registration || !registration.events) notFound();

  const event = registration.events as unknown as {
    title: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    venue_name: string | null;
    location_type: string;
    virtual_url: string | null;
  };

  const ticketType = ticket.event_ticket_types as { name: string } | null;
  const isCheckedIn = !!ticket.checked_in_at;
  const isCancelled = registration.status === 'cancelled';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      timeZone: event.timezone || 'America/Denver',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${
        isCheckedIn ? 'bg-green-100 dark:bg-green-900' :
        isCancelled ? 'bg-red-100 dark:bg-red-900' :
        'bg-blue-100 dark:bg-blue-900'
      }`}>
        {isCheckedIn ? (
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        ) : (
          <Ticket className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        )}
      </div>

      <h1 className="mb-2 text-2xl font-bold">
        {isCheckedIn ? 'Already Checked In' : isCancelled ? 'Registration Cancelled' : 'Event Ticket'}
      </h1>

      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{event.title}</h2>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(event.starts_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {event.location_type === 'virtual' ? (
                <><Monitor className="h-4 w-4" /><span>Virtual</span></>
              ) : event.venue_name ? (
                <><MapPin className="h-4 w-4" /><span>{event.venue_name}</span></>
              ) : null}
            </div>
          </div>

          <div className="border-t pt-4 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {ticket.attendee_name || registration.registrant_name}</p>
            <p><span className="text-muted-foreground">Email:</span> {registration.registrant_email}</p>
            {ticketType?.name && (
              <p><span className="text-muted-foreground">Ticket:</span> {ticketType.name}</p>
            )}
          </div>

          <div className="border-t pt-4">
            {isCheckedIn ? (
              <div className="text-center space-y-2">
                <Badge variant="outline" className="text-green-700 dark:text-green-400 text-base px-4 py-1">
                  Checked In
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {new Date(ticket.checked_in_at!).toLocaleString()}
                </p>
              </div>
            ) : isCancelled ? (
              <div className="text-center">
                <Badge variant="destructive" className="text-base px-4 py-1">
                  Cancelled
                </Badge>
              </div>
            ) : (
              <TicketCheckInButton qrCode={qrCode} registrantName={ticket.attendee_name || registration.registrant_name} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
