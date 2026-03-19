/**
 * Google Calendar API client — fetch events, push bookings, check free/busy.
 *
 * Uses the same Google OAuth infrastructure as Gmail but with calendar-specific scopes.
 * Token refresh is handled transparently via ensureFreshToken().
 */

import { createServiceClient } from '@/lib/supabase/server';
import { refreshAccessToken, isTokenExpired, calculateTokenExpiry } from '@/lib/gmail/oauth';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// Calendar-specific scopes (separate from Gmail scopes)
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// ============================================================
// Token management
// ============================================================

interface IntegrationTokens {
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
}

/**
 * Ensure the integration has a fresh access token. Refreshes if expired.
 * Updates the DB row with new tokens if refreshed.
 */
export async function ensureFreshToken(integrationId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: integration, error } = await supabase
    .from('calendar_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', integrationId)
    .single();

  if (error || !integration) {
    throw new Error('Calendar integration not found');
  }

  const tokens = integration as IntegrationTokens;

  // Check if token needs refresh
  if (tokens.token_expires_at && !isTokenExpired(tokens.token_expires_at)) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    // Mark integration as expired
    await supabase
      .from('calendar_integrations')
      .update({ status: 'expired', last_sync_error: 'No refresh token available' })
      .eq('id', integrationId);
    throw new Error('No refresh token available — user must reconnect');
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    const newExpiry = calculateTokenExpiry(refreshed.expires_in);

    await supabase
      .from('calendar_integrations')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
        token_expires_at: newExpiry,
        status: 'connected',
      })
      .eq('id', integrationId);

    return refreshed.access_token;
  } catch (err) {
    // Mark as error
    await supabase
      .from('calendar_integrations')
      .update({
        status: 'error',
        last_sync_error: err instanceof Error ? err.message : 'Token refresh failed',
      })
      .eq('id', integrationId);
    throw err;
  }
}

// ============================================================
// Google Calendar API calls
// ============================================================

export interface CalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;            // confirmed, tentative, cancelled
  transparency?: string;      // opaque (busy) or transparent (free)
  attendees?: Array<{ email: string; responseStatus?: string }>;
}

export interface EventListResponse {
  items: CalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  /** True when Google returned 410 Gone (sync token expired). */
  invalidSyncToken?: boolean;
}

/**
 * List events from a Google Calendar.
 * Supports incremental sync via syncToken.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin?: string;
    timeMax?: string;
    syncToken?: string;
    maxResults?: number;
    singleEvents?: boolean;
  } = {}
): Promise<EventListResponse> {
  const params = new URLSearchParams();

  if (options.syncToken) {
    // Incremental sync — don't pass timeMin/timeMax
    params.set('syncToken', options.syncToken);
  } else {
    if (options.timeMin) params.set('timeMin', options.timeMin);
    if (options.timeMax) params.set('timeMax', options.timeMax);
    params.set('singleEvents', String(options.singleEvents ?? true));
    params.set('orderBy', 'startTime');
  }

  params.set('maxResults', String(options.maxResults ?? 250));

  const allItems: CalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      // Sync token expired — caller should do a full sync
      return { items: [], nextSyncToken: undefined, invalidSyncToken: true };
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (data.items) allItems.push(...data.items);
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { items: allItems, nextSyncToken };
}

/**
 * Create an event in Google Calendar (push booking).
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
    location?: string;
    conferenceData?: { createRequest?: { requestId: string; conferenceSolutionKey?: { type: string } } };
  },
  options?: { conferenceDataVersion?: number }
): Promise<CalendarEvent> {
  const params = new URLSearchParams();
  if (options?.conferenceDataVersion != null) {
    params.set('conferenceDataVersion', String(options.conferenceDataVersion));
  }

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create calendar event (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 204 = success, 410 = already deleted
  if (!res.ok && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Failed to delete calendar event (${res.status}): ${text}`);
  }
}

/**
 * Map a Google Calendar event to our synced_events schema.
 */
export function mapEventToSyncedEvent(
  event: CalendarEvent,
  integrationId: string,
  userId: string
): {
  integration_id: string;
  user_id: string;
  external_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  status: 'busy' | 'free' | 'tentative' | 'out_of_office';
  source_calendar: string | null;
  raw_data: Record<string, unknown>;
} | null {
  // Skip cancelled events
  if (event.status === 'cancelled') return null;

  const isAllDay = !event.start.dateTime;
  const startAt = event.start.dateTime || (event.start.date ? `${event.start.date}T00:00:00Z` : null);
  const endAt = event.end.dateTime || (event.end.date ? `${event.end.date}T00:00:00Z` : null);

  if (!startAt || !endAt) return null;

  // Map transparency/status to our status enum
  let status: 'busy' | 'free' | 'tentative' | 'out_of_office' = 'busy';
  if (event.transparency === 'transparent') {
    status = 'free';
  } else if (event.status === 'tentative') {
    status = 'tentative';
  }

  return {
    integration_id: integrationId,
    user_id: userId,
    external_id: event.id,
    title: event.summary || null,
    start_at: startAt,
    end_at: endAt,
    is_all_day: isAllDay,
    status,
    source_calendar: null,
    raw_data: event as unknown as Record<string, unknown>,
  };
}
