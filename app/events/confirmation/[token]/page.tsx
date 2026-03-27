import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { CheckCircle2, CalendarDays, Download, QrCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TicketQrCode } from './ticket-qr-code';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ConfirmationPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: registration } = await supabase
    .from('event_registrations')
    .select('id, registrant_name, registrant_email, status, cancel_token, confirmation_token, events(title, starts_at, ends_at, timezone, venue_name, venue_address, location_type, virtual_url)')
    .eq('confirmation_token', token)
    .single();

  if (!registration || !registration.events) notFound();

  // Fetch tickets for this registration
  const { data: tickets } = await supabase
    .from('event_registration_tickets')
    .select('id, qr_code, checked_in_at, attendee_name, ticket_type_id, event_ticket_types(name)')
    .eq('registration_id', registration.id)
    .order('created_at', { ascending: true });

  const event = registration.events as unknown as {
    title: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    venue_name: string | null;
    venue_address: string | null;
    location_type: string;
    virtual_url: string | null;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      timeZone: event.timezone || 'America/Denver',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

  const location = event.location_type === 'virtual'
    ? event.virtual_url || 'Virtual'
    : [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'TBD';

  const googleCalendarUrl = (() => {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${new Date(event.starts_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${new Date(event.ends_at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  const isCancelled = registration.status === 'cancelled';
  const statusMessage = isCancelled
    ? 'This registration has been cancelled.'
    : registration.status === 'confirmed'
      ? 'Your registration is confirmed!'
      : registration.status === 'waitlisted'
        ? 'You have been placed on the waitlist. We\'ll notify you if a spot opens up.'
        : registration.status === 'pending_approval'
          ? 'Your registration is pending approval.'
          : registration.status === 'pending_waiver'
            ? 'Your registration is pending waiver completion. Please check your email to sign the required waiver.'
            : 'Your registration has been received.';

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-full ${isCancelled ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
        <CheckCircle2 className={`h-8 w-8 ${isCancelled ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
      </div>

      <h1 className="mb-2 text-2xl font-bold">{isCancelled ? 'Registration Cancelled' : registration.status === 'confirmed' ? 'Registration Confirmed!' : 'Registration Received!'}</h1>
      <p className="mb-6 text-muted-foreground">{statusMessage}</p>

      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{event.title}</h2>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(event.starts_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="ml-6">to {formatDate(event.ends_at)}</span>
            </div>
            <div className="text-muted-foreground ml-6">{location}</div>
          </div>

          <div className="border-t pt-4 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {registration.registrant_name}</p>
            <p><span className="text-muted-foreground">Email:</span> {registration.registrant_email}</p>
          </div>

          {!isCancelled && (
            <>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
                    <CalendarDays className="mr-1 h-3 w-3" />Google
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <a href={`/api/events/ics?token=${registration.confirmation_token}`} download>
                    <Download className="mr-1 h-3 w-3" />.ics
                  </a>
                </Button>
              </div>

              {/* Tickets with QR Codes */}
              {registration.status === 'confirmed' && tickets && tickets.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    Your Ticket{tickets.length !== 1 ? 's' : ''}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Present this QR code at the event for check-in.
                  </p>
                  <div className="grid gap-3">
                    {tickets.map((ticket, i) => {
                      const ticketType = ticket.event_ticket_types as { name: string } | null;
                      return (
                        <div key={ticket.id} className="rounded-lg border p-4 flex flex-col items-center gap-2">
                          {tickets.length > 1 && (
                            <div className="text-xs text-muted-foreground uppercase tracking-wide">
                              Ticket {i + 1}
                              {ticketType?.name && ` — ${ticketType.name}`}
                            </div>
                          )}
                          {tickets.length === 1 && ticketType?.name && (
                            <div className="text-xs text-muted-foreground">{ticketType.name}</div>
                          )}
                          {ticket.qr_code && (
                            <TicketQrCode value={`${process.env.NEXT_PUBLIC_APP_URL || ''}/events/ticket/${ticket.qr_code}`} size={160} />
                          )}
                          {ticket.attendee_name && (
                            <p className="text-sm font-medium">{ticket.attendee_name}</p>
                          )}
                          {ticket.checked_in_at ? (
                            <Badge variant="outline" className="text-green-700">Checked in</Badge>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Need to cancel?{' '}
                <a href={`/events/cancel/${registration.cancel_token}`} className="underline hover:text-foreground">
                  Cancel registration
                </a>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
