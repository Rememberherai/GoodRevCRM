'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Monitor, Repeat, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  quantity_available: number | null;
  max_per_order: number;
  remaining: number | null;
}

interface Props {
  event: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    description_html: string | null;
    cover_image_url: string | null;
    category: string | null;
    starts_at: string;
    ends_at: string;
    timezone: string;
    location_type: string;
    venue_name: string | null;
    venue_address: string | null;
    virtual_url: string | null;
    registration_enabled: boolean;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
    require_approval: boolean;
    total_capacity: number | null;
    waitlist_enabled: boolean;
    remaining_capacity: number | null;
    organizer_name: string | null;
    organizer_email: string | null;
    custom_questions: unknown;
    cancellation_policy: string | null;
  };
  ticketTypes: TicketType[];
  seriesTicketTypes?: TicketType[];
  calendarSlug: string;
  embed?: boolean;
  seriesId?: string | null;
  seriesTitle?: string | null;
}

export function PublicEventDetail({
  event,
  ticketTypes,
  seriesTicketTypes = [],
  calendarSlug,
  embed = false,
  seriesId = null,
  seriesTitle = null,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [seriesSuccessMessage, setSeriesSuccessMessage] = useState<string | null>(null);
  const [eventTicketSelections, setEventTicketSelections] = useState<Record<string, number>>(() => {
    if (ticketTypes.length > 0) {
      return { [ticketTypes[0]!.id]: 1 };
    }
    return {};
  });
  const [seriesSelections, setSeriesSelections] = useState<Record<string, number>>(() => {
    if (seriesTicketTypes.length > 0) {
      return { [seriesTicketTypes[0]!.id]: 1 };
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerMode, setRegisterMode] = useState<'event' | 'series'>(
    seriesId && event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled
      ? 'series'
      : 'event'
  );
  const isSeriesRegistration = registerMode === 'series' && Boolean(seriesId);
  const activeTicketTypes = isSeriesRegistration ? seriesTicketTypes : ticketTypes;
  const activeSelections = isSeriesRegistration ? seriesSelections : eventTicketSelections;

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
      details: event.description || '',
      location,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    const selections = Object.entries(activeSelections)
      .filter(([, qty]) => qty > 0)
      .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }));

    if (selections.length === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    if (
      registerMode === 'event' &&
      event.remaining_capacity !== null &&
      event.remaining_capacity <= 0 &&
      !event.waitlist_enabled
    ) {
      toast.error('This event is full. Register for the full series instead.');
      return;
    }

    setIsSubmitting(true);

    try {
      const isSeries = registerMode === 'series' && seriesId;

      const endpoint = isSeries ? '/api/events/register-series' : '/api/events/register';
      const body = isSeries
        ? {
            series_id: seriesId,
            registrant_name: name,
            registrant_email: email,
            registrant_phone: phone || null,
            ticket_selections: selections,
          }
        : {
            event_id: event.id,
            registrant_name: name,
            registrant_email: email,
            registrant_phone: phone || null,
            ticket_selections: selections,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Registration failed');
        setIsSubmitting(false);
        return;
      }

      if (isSeries) {
        const count = data.instanceCount ?? 0;
        const failed = data.failedInstances?.length ?? 0;
        toast.success(`Registered for ${count - failed} events in the series`);
        setRegistrationStatus('confirmed');
        setSeriesSuccessMessage(
          failed > 0
            ? `Registered for ${count - failed} events in this series. ${failed} future instance${failed === 1 ? '' : 's'} could not be registered.`
            : `Registered for ${count} events in this series.`
        );
        setIsSubmitting(false);
        return;
      }

      if (embed && typeof window !== 'undefined') {
        window.parent.postMessage({
          type: 'goodrev:event:registered',
          registrationId: data.registration.id,
          eventTitle: event.title,
        }, '*');
        setRegistrationStatus(data.registration.status);
        setIsSubmitting(false);
        return;
      }

      router.push(`/events/confirmation/${data.registration.confirmation_token}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {event.cover_image_url && (
        <div className="overflow-hidden rounded-xl">
          <img src={event.cover_image_url} alt={event.title} className="w-full h-64 object-cover" />
        </div>
      )}

      <div>
        <div className="flex items-start gap-3">
          <h1 className="text-3xl font-bold">{event.title}</h1>
          {event.category && <Badge variant="outline">{event.category}</Badge>}
        </div>
        {seriesId && seriesTitle && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Repeat className="h-4 w-4" />
            <span>Part of the series: <strong className="text-foreground">{seriesTitle}</strong></span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Event details */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{formatDate(event.starts_at)}</p>
                  <p className="text-muted-foreground">to {formatDate(event.ends_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                {event.location_type === 'virtual' ? (
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                )}
                <p>{location}</p>
              </div>

              {event.organizer_name && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <p>Organized by {event.organizer_name}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
                    Add to Google Calendar
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/events/ics?calendar=${calendarSlug}&event=${event.slug}`} download>
                    Download .ics
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {event.description_html ? (
            <Card>
              <CardContent className="p-5 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: event.description_html }} />
            </Card>
          ) : event.description ? (
            <Card>
              <CardContent className="p-5">
                <p className="text-sm whitespace-pre-wrap">{event.description}</p>
              </CardContent>
            </Card>
          ) : null}

          {event.cancellation_policy && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Cancellation Policy</CardTitle></CardHeader>
              <CardContent className="pt-0"><p className="text-sm text-muted-foreground">{event.cancellation_policy}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Registration form */}
        <div>
          {(() => {
            const now = new Date();
            const notYetOpen = event.registration_opens_at && new Date(event.registration_opens_at) > now;
            const alreadyClosed = event.registration_closes_at && new Date(event.registration_closes_at) < now;
            const atCapacity = event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled;

            if (!event.registration_enabled) {
              return (
                <Card>
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    Registration is currently closed for this event.
                  </CardContent>
                </Card>
              );
            }

            if (notYetOpen) {
              return (
                <Card>
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    Registration opens on {new Date(event.registration_opens_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}.
                  </CardContent>
                </Card>
              );
            }

            if (alreadyClosed) {
              return (
                <Card>
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    Registration for this event has closed.
                  </CardContent>
                </Card>
              );
            }

            if (atCapacity && !seriesId) {
              return (
                <Card>
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    This event is at full capacity.
                  </CardContent>
                </Card>
              );
            }

            return null;
          })() || (event.registration_enabled && activeTicketTypes.length === 0 && (
            <Card>
              <CardContent className="p-5 text-center text-sm text-muted-foreground">
                {isSeriesRegistration
                  ? 'Series registration is not available yet for this event.'
                  : 'Registration is being set up. Please check back soon.'}
              </CardContent>
            </Card>
          )) || (event.registration_enabled && activeTicketTypes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Register</CardTitle>
                {event.require_approval && (
                  <p className="text-xs text-muted-foreground">Registration requires approval</p>
                )}
                {event.remaining_capacity !== null && event.waitlist_enabled && event.remaining_capacity <= 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Event is full — you will be added to the waitlist</p>
                )}
                {seriesId && event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">This instance is full, but you can still register for the full series.</p>
                )}
              </CardHeader>
              <CardContent>
                {(seriesSuccessMessage || (embed && registrationStatus)) ? (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{seriesSuccessMessage ? 'Series registration submitted.' : 'Registration submitted.'}</p>
                    {seriesSuccessMessage ? (
                      <p className="text-muted-foreground">{seriesSuccessMessage}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        {registrationStatus === 'confirmed'
                          ? 'The parent page has been notified and your spot is confirmed.'
                          : `The parent page has been notified. Current status: ${registrationStatus}.`}
                      </p>
                    )}
                  </div>
                ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Name *</Label>
                    <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email *</Label>
                    <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone</Label>
                    <Input id="reg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>

                  {seriesId && (
                    <div className="space-y-2">
                      <Label>Registration Type</Label>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer rounded border p-2 text-sm">
                          <input
                            type="radio"
                            name="registerMode"
                            checked={registerMode === 'event'}
                            onChange={() => setRegisterMode('event')}
                            disabled={event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled}
                          />
                          <span className={event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled ? 'text-muted-foreground' : ''}>
                            Register for this event only
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer rounded border p-2 text-sm">
                          <input type="radio" name="registerMode" checked={registerMode === 'series'} onChange={() => setRegisterMode('series')} />
                          Register for entire series
                        </label>
                      </div>
                    </div>
                  )}

                  {activeTicketTypes.length > 0 && (
                    <div className="space-y-3">
                      <Label>Tickets</Label>
                      {activeTicketTypes.map((tt) => (
                        <div key={tt.id} className="flex items-center justify-between rounded border p-2">
                          <div>
                            <p className="text-sm font-medium">{tt.name}</p>
                            {tt.description && <p className="text-xs text-muted-foreground">{tt.description}</p>}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            max={registerMode === 'series'
                              ? tt.max_per_order
                              : tt.remaining != null
                                ? Math.min(tt.max_per_order, tt.remaining)
                                : tt.max_per_order}
                            value={activeSelections[tt.id] ?? 0}
                            onChange={(e) => {
                              const quantity = parseInt(e.target.value) || 0;
                              if (isSeriesRegistration) {
                                setSeriesSelections((prev) => ({ ...prev, [tt.id]: quantity }));
                              } else {
                                setEventTicketSelections((prev) => ({ ...prev, [tt.id]: quantity }));
                              }
                            }}
                            className="w-16 text-center"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Registering...' : 'Register'}
                  </Button>
                </form>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
