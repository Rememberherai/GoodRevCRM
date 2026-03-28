/**
 * .ics calendar file generation for booking confirmations.
 *
 * Produces a valid iCalendar (RFC 5545) VEVENT that can be
 * downloaded or attached to confirmation emails.
 */

interface IcsEventInput {
  uid: string;          // Unique ID (booking ID works)
  summary: string;      // Event title
  description?: string;
  location?: string;
  startAt: string;      // ISO datetime
  endAt: string;        // ISO datetime
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  url?: string;         // Meeting URL or cancel link
}

/**
 * Generate a .ics file content string for a booking.
 */
export function generateIcs(event: IcsEventInput): string {
  const now = formatIcsDate(new Date().toISOString());
  const start = formatIcsDate(event.startAt);
  const end = formatIcsDate(event.endAt);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoodRev//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}@goodrev.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  if (event.organizerEmail) {
    const cn = event.organizerName ? `;CN=${escapeIcsText(event.organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${event.organizerEmail}`);
  }

  if (event.attendeeEmail) {
    const cn = event.attendeeName ? `;CN=${escapeIcsText(event.attendeeName)}` : '';
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED${cn}:mailto:${event.attendeeEmail}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('BEGIN:VALARM');
  lines.push('TRIGGER:-PT15M');
  lines.push('ACTION:DISPLAY');
  lines.push('DESCRIPTION:Reminder');
  lines.push('END:VALARM');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n');
}

/** Fold long lines per RFC 5545 Section 3.1 (75-octet limit) */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let byteOffset = 0;
  let isFirst = true;

  while (byteOffset < bytes.length) {
    // First line gets 75 bytes; continuation lines get 74 (plus leading space)
    const maxBytes = isFirst ? 75 : 74;
    let end = Math.min(byteOffset + maxBytes, bytes.length);

    // Don't split in the middle of a multi-byte UTF-8 character.
    // UTF-8 continuation bytes start with 0b10xxxxxx (0x80..0xBF).
    while (end < bytes.length && end > byteOffset && (bytes[end]! & 0xc0) === 0x80) {
      end--;
    }

    const chunk = new TextDecoder().decode(bytes.slice(byteOffset, end));
    parts.push(isFirst ? chunk : ' ' + chunk);
    byteOffset = end;
    isFirst = false;
  }

  return parts.join('\r\n');
}

/** Format ISO datetime to iCalendar UTC format (YYYYMMDDTHHMMSSZ) */
function formatIcsDate(isoDate: string): string {
  return new Date(isoDate).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escape special characters in iCalendar text values */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// ── iCal subscription feed ─────────────────────────────────

export interface IcsFeedEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  url?: string;
}

/**
 * Generate a full iCalendar feed (VCALENDAR with multiple VEVENTs)
 * for calendar subscription via webcal:// or https://.
 */
export function generateIcsFeed(
  calendarName: string,
  events: IcsFeedEvent[],
  options?: { description?: string; timezone?: string },
): string {
  const now = formatIcsDate(new Date().toISOString());
  const tz = options?.timezone || 'America/Denver';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoodRev//Calendar//1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-CALDESC:${escapeIcsText(options?.description || `Events for ${calendarName}`)}`,
    `X-WR-TIMEZONE:${tz}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}@goodrev.com`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${formatIcsDate(event.startAt)}`);
    lines.push(`DTEND:${formatIcsDate(event.endAt)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }
    if (event.url) {
      lines.push(`URL:${event.url}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n');
}
