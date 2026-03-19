/**
 * Calendar sync engine — pull events from Google Calendar, push bookings.
 *
 * Pull: Fetches events for next 60 days → upserts synced_events → deletes stale.
 * Push: After booking creation → creates event in Google Calendar.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import {
  ensureFreshToken,
  listEvents,
  createEvent,
  deleteEvent,
  mapEventToSyncedEvent,
  type EventListResponse,
} from './google-calendar';

// ============================================================
// Pull sync — fetch events from Google Calendar
// ============================================================

interface SyncResult {
  success: boolean;
  eventsUpserted: number;
  eventsDeleted: number;
  error?: string;
}

/**
 * Sync events for a single calendar integration.
 * Uses incremental sync (syncToken) when available, falls back to full sync.
 */
export async function syncCalendarEvents(integrationId: string): Promise<SyncResult> {
  const supabase = createServiceClient();

  // Load integration
  const { data: integration, error: loadError } = await supabase
    .from('calendar_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (loadError || !integration) {
    return { success: false, eventsUpserted: 0, eventsDeleted: 0, error: 'Integration not found' };
  }

  try {
    const accessToken = await ensureFreshToken(integrationId);
    const calendarId = integration.calendar_id || 'primary';

    const syncToken = integration.sync_token as string | null;
    let fullSync = !syncToken || !integration.initial_sync_done;

    // Try incremental sync first, fall back to full sync on 410
    const result = await listEvents(accessToken, calendarId, {
      syncToken: fullSync ? undefined : (syncToken ?? undefined),
      timeMin: fullSync ? new Date().toISOString() : undefined,
      timeMax: fullSync
        ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
        : undefined,
    });

    // 410 Gone — sync token expired, do full sync
    if (result.invalidSyncToken && !fullSync) {
      fullSync = true;
      const fullResult = await listEvents(accessToken, calendarId, {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      });
      // Pass null as existingSyncToken — the old token is invalid (410), so we must
      // not preserve it if the full sync somehow fails to return a new one.
      return await processEvents(fullResult, integration.id, integration.user_id, null, supabase, true);
    }

    return await processEvents(result, integration.id, integration.user_id, integration.sync_token, supabase, fullSync);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    console.error(`Calendar sync failed for integration ${integrationId}:`, errorMsg);

    // Update error state
    await supabase
      .from('calendar_integrations')
      .update({
        sync_errors_count: (integration.sync_errors_count ?? 0) + 1,
        last_sync_error: errorMsg,
      })
      .eq('id', integrationId);

    return { success: false, eventsUpserted: 0, eventsDeleted: 0, error: errorMsg };
  }
}

async function processEvents(
  result: EventListResponse,
  integrationId: string,
  userId: string,
  existingSyncToken: string | null,
  supabase: ReturnType<typeof createServiceClient>,
  fullSync: boolean
): Promise<SyncResult> {
  let eventsUpserted = 0;
  let eventsDeleted = 0;
  let upsertErrors = 0;

  // Collect external IDs seen in this sync for stale cleanup
  const seenExternalIds = new Set<string>();

  for (const event of result.items) {
    const mapped = mapEventToSyncedEvent(event, integrationId, userId);

    if (!mapped) {
      // Cancelled event — delete from synced_events if it exists
      if (event.id) {
        await supabase
          .from('synced_events')
          .delete()
          .eq('integration_id', integrationId)
          .eq('external_id', event.id);
        eventsDeleted++;
      }
      continue;
    }

    seenExternalIds.add(event.id);

    // Upsert event — cast raw_data for Json compatibility.
    // Omit source_calendar so pull sync doesn't overwrite booking references
    // set by pushBookingToCalendar (e.g. "booking:<id>").
    const { source_calendar: _sc, ...upsertData } = mapped;
    const { error: upsertError } = await supabase
      .from('synced_events')
      .upsert(
        { ...upsertData, raw_data: upsertData.raw_data as unknown as Json },
        { onConflict: 'integration_id,external_id' }
      );

    if (upsertError) {
      console.error(`Failed to upsert synced event ${event.id} for integration ${integrationId}:`, upsertError.message);
      upsertErrors++;
    } else {
      eventsUpserted++;
    }
  }

  // If every upsert failed, treat the sync as failed
  if (upsertErrors > 0 && eventsUpserted === 0 && result.items.length > 0) {
    return {
      success: false,
      eventsUpserted: 0,
      eventsDeleted,
      error: `All ${upsertErrors} event upserts failed — possible database issue`,
    };
  }

  // On full sync, delete events that weren't in the response.
  // Preserve booking tracking rows (source_calendar LIKE 'booking:%') so
  // removeBookingFromCalendar can still find and delete the Google event.
  if (fullSync && seenExternalIds.size > 0) {
    const { data: existing } = await supabase
      .from('synced_events')
      .select('id, external_id, source_calendar')
      .eq('integration_id', integrationId);

    if (existing) {
      const staleIds = existing
        .filter((e) => !seenExternalIds.has(e.external_id) && !e.source_calendar?.startsWith('booking:'))
        .map((e) => e.id);

      if (staleIds.length > 0) {
        await supabase
          .from('synced_events')
          .delete()
          .in('id', staleIds);
        eventsDeleted += staleIds.length;
      }
    }
  } else if (fullSync && seenExternalIds.size === 0) {
    // Full sync returned no active events (all cancelled or empty) — delete
    // pull-synced events but preserve booking tracking rows.
    await supabase
      .from('synced_events')
      .delete()
      .eq('integration_id', integrationId)
      .is('source_calendar', null);
  }

  // Update integration state
  await supabase
    .from('calendar_integrations')
    .update({
      sync_token: result.nextSyncToken ?? existingSyncToken,
      last_synced_at: new Date().toISOString(),
      initial_sync_done: true,
      sync_errors_count: 0,
      last_sync_error: null,
      status: 'connected',
    })
    .eq('id', integrationId);

  return { success: true, eventsUpserted, eventsDeleted };
}

// ============================================================
// Push — create Google Calendar event from a booking
// ============================================================

/**
 * Push a booking to Google Calendar as an event.
 * Returns the external event ID if successful.
 * Also stores a tracking row in synced_events so we can remove the event on cancellation.
 */
export async function pushBookingToCalendar(bookingId: string): Promise<string | null> {
  const supabase = createServiceClient();

  // Load booking with event type
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*, event_types(title, user_id)')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('Failed to load booking for calendar push:', bookingError?.message);
    return null;
  }

  const eventType = booking.event_types as { title: string; user_id: string } | null;
  if (!eventType) return null;

  // Find the user's connected calendar integration
  const { data: integration } = await supabase
    .from('calendar_integrations')
    .select('id, calendar_id')
    .eq('user_id', eventType.user_id)
    .eq('status', 'connected')
    .eq('push_enabled', true)
    .order('is_primary', { ascending: false })
    .limit(1)
    .single();

  if (!integration) return null; // No connected calendar — skip silently

  try {
    const accessToken = await ensureFreshToken(integration.id);
    const calendarId = integration.calendar_id || 'primary';

    const calEvent = await createEvent(accessToken, calendarId, {
      summary: `${eventType.title} with ${booking.invitee_name}`,
      description: [
        `Invitee: ${booking.invitee_name} (${booking.invitee_email})`,
        booking.invitee_phone ? `Phone: ${booking.invitee_phone}` : '',
        booking.invitee_notes ? `Notes: ${booking.invitee_notes}` : '',
      ].filter(Boolean).join('\n'),
      start: { dateTime: booking.start_at },
      end: { dateTime: booking.end_at },
      attendees: [{ email: booking.invitee_email }],
      location: booking.location || undefined,
    });

    // Track the pushed event in synced_events so we can remove it on cancellation.
    // source_calendar stores a booking reference for lookup by removeBookingFromCalendar.
    await supabase.from('synced_events').upsert(
      {
        integration_id: integration.id,
        user_id: eventType.user_id,
        external_id: calEvent.id,
        title: `${eventType.title} with ${booking.invitee_name}`,
        start_at: booking.start_at,
        end_at: booking.end_at,
        is_all_day: false,
        status: 'busy',
        source_calendar: `booking:${bookingId}`,
        raw_data: calEvent as unknown as Json,
      },
      { onConflict: 'integration_id,external_id' }
    );

    return calEvent.id;
  } catch (err) {
    console.error('Failed to push booking to calendar:', err);
    return null;
  }
}

/**
 * Delete a booking's event from Google Calendar (on cancellation).
 * Looks up the external event ID from synced_events via the booking reference.
 */
export async function removeBookingFromCalendar(bookingId: string): Promise<void> {
  const supabase = createServiceClient();

  // Look up the synced_events row that was created when the booking was pushed
  const { data: syncedEvent } = await supabase
    .from('synced_events')
    .select('external_id, integration_id')
    .eq('source_calendar', `booking:${bookingId}`)
    .single();

  if (!syncedEvent) return; // Booking was never pushed to calendar — nothing to remove

  const { data: integration } = await supabase
    .from('calendar_integrations')
    .select('id, calendar_id')
    .eq('id', syncedEvent.integration_id)
    .eq('status', 'connected')
    .single();

  if (!integration) return;

  try {
    const accessToken = await ensureFreshToken(integration.id);
    const calendarId = integration.calendar_id || 'primary';
    await deleteEvent(accessToken, calendarId, syncedEvent.external_id);

    // Clean up the tracking row
    await supabase
      .from('synced_events')
      .delete()
      .eq('source_calendar', `booking:${bookingId}`);
  } catch (err) {
    console.error('Failed to remove booking from calendar:', err);
  }
}

/**
 * Push a booking to multiple team members' Google Calendars (for collective events).
 * Each member's calendar gets its own event. Failures for individual members don't
 * block others (fire-and-forget per member).
 */
export async function pushBookingToTeamCalendars(
  bookingId: string,
  memberUserIds: string[]
): Promise<void> {
  const supabase = createServiceClient();

  // Load booking with event type
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*, event_types(title)')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    console.error('Failed to load booking for team calendar push:', bookingError?.message);
    return;
  }

  const eventType = booking.event_types as { title: string } | null;
  if (!eventType) return;

  for (const userId of memberUserIds) {
    // Find each member's connected calendar integration
    const { data: integration } = await supabase
      .from('calendar_integrations')
      .select('id, calendar_id')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .eq('push_enabled', true)
      .order('is_primary', { ascending: false })
      .limit(1)
      .single();

    if (!integration) continue; // Member has no connected calendar

    try {
      const accessToken = await ensureFreshToken(integration.id);
      const calendarId = integration.calendar_id || 'primary';

      const calEvent = await createEvent(accessToken, calendarId, {
        summary: `${eventType.title} with ${booking.invitee_name}`,
        description: [
          `Invitee: ${booking.invitee_name} (${booking.invitee_email})`,
          booking.invitee_phone ? `Phone: ${booking.invitee_phone}` : '',
          booking.invitee_notes ? `Notes: ${booking.invitee_notes}` : '',
        ].filter(Boolean).join('\n'),
        start: { dateTime: booking.start_at },
        end: { dateTime: booking.end_at },
        attendees: [{ email: booking.invitee_email }],
        location: booking.location || undefined,
      });

      // Track the pushed event
      await supabase.from('synced_events').upsert(
        {
          integration_id: integration.id,
          user_id: userId,
          external_id: calEvent.id,
          title: `${eventType.title} with ${booking.invitee_name}`,
          start_at: booking.start_at,
          end_at: booking.end_at,
          is_all_day: false,
          status: 'busy',
          source_calendar: `booking:${bookingId}`,
          raw_data: calEvent as unknown as Json,
        },
        { onConflict: 'integration_id,external_id' }
      );
    } catch (err) {
      console.error(`Failed to push booking to calendar for user ${userId}:`, err);
    }
  }
}
