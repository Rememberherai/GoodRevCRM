'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock, MapPin, Monitor, Repeat, User, ArrowLeft, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Link from 'next/link';

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
    recording_url: string | null;
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

  const isPast = new Date(event.ends_at) < new Date();
  const eventDate = new Date(event.starts_at);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      timeZone: event.timezone || 'America/Denver',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      timeZone: event.timezone || 'America/Denver',
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

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: event.title, url: window.location.href }).catch(() => {});
    } else if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  }

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
    <div className="space-y-0">
      {/* Hero section */}
      {event.cover_image_url ? (
        <div className="relative -mx-4 -mt-8 mb-6 sm:-mx-4">
          <div className="h-56 sm:h-72 md:h-80 overflow-hidden">
            <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <div className="mx-auto max-w-4xl">
              {!embed && (
                <Link href={`/events/${calendarSlug}`} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white mb-3 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Events
                </Link>
              )}
              <div className="flex items-start gap-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{event.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {event.category && <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">{event.category}</Badge>}
                {seriesId && seriesTitle && (
                  <Badge variant="outline" className="bg-white/10 text-white/90 border-white/30 backdrop-blur-sm">
                    <Repeat className="h-3 w-3 mr-1" />
                    {seriesTitle}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          {!embed && (
            <Link href={`/events/${calendarSlug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Events
            </Link>
          )}
          <div className="flex items-start gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{event.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {event.category && <Badge variant="outline">{event.category}</Badge>}
            {seriesId && seriesTitle && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Repeat className="h-3.5 w-3.5" />
                <span>Part of: <strong className="text-foreground">{seriesTitle}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Event details — left column */}
        <div className="md:col-span-2 space-y-5">
          {/* Key details card */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {/* Date & Time */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center rounded-lg bg-primary/10 px-3 py-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-primary uppercase">
                        {eventDate.toLocaleDateString('en-US', { timeZone: event.timezone || 'America/Denver', month: 'short' })}
                      </span>
                      <span className="text-2xl font-bold text-primary leading-tight">
                        {eventDate.toLocaleDateString('en-US', { timeZone: event.timezone || 'America/Denver', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold">{formatDate(event.starts_at)}</p>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatTime(event.starts_at)} – {formatTime(event.ends_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                      {event.location_type === 'virtual' ? (
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold">
                        {event.location_type === 'virtual' ? 'Virtual Event' : event.venue_name || 'Location TBD'}
                      </p>
                      {event.venue_address && (
                        <p className="text-sm text-muted-foreground mt-0.5">{event.venue_address}</p>
                      )}
                      {isPast && event.recording_url ? (
                        <a href={event.recording_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-0.5">
                          Watch Recording <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : isPast ? (
                        <p className="text-sm text-muted-foreground mt-0.5">This event has ended</p>
                      ) : event.location_type === 'virtual' && event.virtual_url ? (
                        <a href={event.virtual_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-0.5">
                          Join link <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Organizer & actions bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 bg-muted/30">
                <div className="flex items-center gap-4">
                  {event.organizer_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span>Organized by <strong className="text-foreground">{event.organizer_name}</strong></span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleShare} className="text-xs">
                    <Share2 className="h-3.5 w-3.5 mr-1" />
                    Share
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="text-xs">
                    <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
                      <CalendarDays className="h-3.5 w-3.5 mr-1" />
                      Google Calendar
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="text-xs">
                    <a href={`/api/events/ics?calendar=${calendarSlug}&event=${event.slug}`} download>
                      <CalendarDays className="h-3.5 w-3.5 mr-1" />
                      .ics
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {event.description_html ? (
            <Card>
              <CardHeader><CardTitle className="text-base">About this event</CardTitle></CardHeader>
              <CardContent className="pt-0 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: event.description_html }} />
            </Card>
          ) : event.description ? (
            <Card>
              <CardHeader><CardTitle className="text-base">About this event</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{event.description}</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Cancellation policy */}
          {event.cancellation_policy && (
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Cancellation Policy</CardTitle></CardHeader>
              <CardContent className="pt-0"><p className="text-sm text-muted-foreground">{event.cancellation_policy}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Registration form — right column */}
        <div className="md:sticky md:top-4 self-start">
          {isPast ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">This event has ended</p>
                {event.recording_url && (
                  <a href={event.recording_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2">
                    Watch Recording <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ) : (() => {
            const now = new Date();
            const notYetOpen = event.registration_opens_at && new Date(event.registration_opens_at) > now;
            const alreadyClosed = event.registration_closes_at && new Date(event.registration_closes_at) < now;
            const atCapacity = event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled;

            if (!event.registration_enabled) {
              return (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Registration is currently closed for this event.</p>
                  </CardContent>
                </Card>
              );
            }

            if (notYetOpen) {
              return (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-sm">Registration opens soon</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(event.registration_opens_at!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </CardContent>
                </Card>
              );
            }

            if (alreadyClosed) {
              return (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Registration for this event has closed.</p>
                  </CardContent>
                </Card>
              );
            }

            if (atCapacity && !seriesId) {
              return (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <p className="font-medium text-sm">Event is at full capacity</p>
                    <p className="text-xs text-muted-foreground mt-1">All spots have been filled.</p>
                  </CardContent>
                </Card>
              );
            }

            return null;
          })() || (event.registration_enabled && activeTicketTypes.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {isSeriesRegistration
                  ? 'Series registration is not available yet for this event.'
                  : 'Registration is being set up. Please check back soon.'}
              </CardContent>
            </Card>
          )) || (event.registration_enabled && activeTicketTypes.length > 0 && (
            <Card className="shadow-lg border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Register</CardTitle>
                {event.require_approval && (
                  <p className="text-xs text-muted-foreground">Registration requires approval</p>
                )}
                {event.remaining_capacity !== null && event.waitlist_enabled && event.remaining_capacity <= 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 w-fit">Waitlist</Badge>
                )}
                {seriesId && event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">This instance is full, but you can register for the full series.</p>
                )}
              </CardHeader>
              <CardContent>
                {(seriesSuccessMessage || (embed && registrationStatus)) ? (
                  <div className="space-y-3 text-center py-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
                      <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="font-semibold">{seriesSuccessMessage ? 'Series registration confirmed!' : 'Registration submitted!'}</p>
                    {seriesSuccessMessage ? (
                      <p className="text-sm text-muted-foreground">{seriesSuccessMessage}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {registrationStatus === 'confirmed'
                          ? 'Your spot is confirmed.'
                          : `Current status: ${registrationStatus}.`}
                      </p>
                    )}
                  </div>
                ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Name *</Label>
                    <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your full name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email *</Label>
                    <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone</Label>
                    <Input id="reg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                  </div>

                  {seriesId && (
                    <div className="space-y-2">
                      <Label>Registration Type</Label>
                      <div className="space-y-2">
                        <label className={`flex items-center gap-3 cursor-pointer rounded-lg border p-3 text-sm transition-colors ${registerMode === 'event' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'} ${event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                          <input
                            type="radio"
                            name="registerMode"
                            checked={registerMode === 'event'}
                            onChange={() => setRegisterMode('event')}
                            disabled={event.remaining_capacity !== null && event.remaining_capacity <= 0 && !event.waitlist_enabled}
                            className="accent-primary"
                          />
                          <div>
                            <p className="font-medium">This event only</p>
                            <p className="text-xs text-muted-foreground">Register for just this date</p>
                          </div>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer rounded-lg border p-3 text-sm transition-colors ${registerMode === 'series' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                          <input type="radio" name="registerMode" checked={registerMode === 'series'} onChange={() => setRegisterMode('series')} className="accent-primary" />
                          <div>
                            <p className="font-medium">Entire series</p>
                            <p className="text-xs text-muted-foreground">Register for all upcoming events</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeTicketTypes.length > 0 && (
                    <div className="space-y-3">
                      <Label>Tickets</Label>
                      {activeTicketTypes.map((tt) => (
                        <div key={tt.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{tt.name}</p>
                            {tt.description && <p className="text-xs text-muted-foreground mt-0.5">{tt.description}</p>}
                            {!isSeriesRegistration && tt.remaining !== null && tt.remaining < 20 && tt.remaining > 0 && (
                              <p className="text-xs text-amber-600 mt-0.5">{tt.remaining} left</p>
                            )}
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
                            className="w-16 text-center flex-shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isSubmitting}>
                    {isSubmitting ? 'Registering...' : 'Register Now'}
                  </Button>

                  {event.remaining_capacity !== null && event.remaining_capacity > 0 && event.remaining_capacity < 20 && (
                    <p className="text-xs text-center text-amber-600">Only {event.remaining_capacity} spots remaining</p>
                  )}
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
