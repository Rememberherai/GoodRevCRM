/**
 * Slot calculation engine — computes available booking slots for an event type.
 *
 * Algorithm:
 * 1. Load event type config (duration, buffers, limits, schedule)
 * 2. Load availability rules + overrides for the date range
 * 3. Load existing active bookings for the host
 * 4. For each day, resolve availability windows (overrides > weekly rules)
 * 5. Generate slots within windows, filtering by bookings, limits, and notice
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { createServiceClient } from '@/lib/supabase/server';
import type { AvailableDay, TimeSlot } from '@/types/calendar';

interface SlotConfig {
  eventTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  inviteeTimezone?: string;
}

interface TimeWindow {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

/**
 * Get available slots for an event type within a date range.
 */
export async function getAvailableSlots(config: SlotConfig): Promise<AvailableDay[]> {
  const supabase = createServiceClient();

  // 1. Load event type
  const { data: eventType, error: etError } = await supabase
    .from('event_types')
    .select('*')
    .eq('id', config.eventTypeId)
    .eq('is_active', true)
    .single();

  if (etError || !eventType) return [];

  // 2. Load availability schedule + rules
  const scheduleId = eventType.schedule_id;
  let rules: { day_of_week: number; start_time: string; end_time: string }[] = [];
  let scheduleTz = 'America/New_York';

  if (scheduleId) {
    const { data: schedule } = await supabase
      .from('availability_schedules')
      .select('timezone')
      .eq('id', scheduleId)
      .single();

    if (schedule) scheduleTz = schedule.timezone;

    const { data: scheduleRules } = await supabase
      .from('availability_rules')
      .select('day_of_week, start_time, end_time')
      .eq('schedule_id', scheduleId);

    if (scheduleRules) rules = scheduleRules;
  } else {
    // If no schedule assigned, try user's default schedule
    const { data: defaultSchedule } = await supabase
      .from('availability_schedules')
      .select('id, timezone')
      .eq('user_id', eventType.user_id)
      .eq('is_default', true)
      .single();

    if (defaultSchedule) {
      scheduleTz = defaultSchedule.timezone;
      const { data: defaultRules } = await supabase
        .from('availability_rules')
        .select('day_of_week, start_time, end_time')
        .eq('schedule_id', defaultSchedule.id);

      if (defaultRules) rules = defaultRules;
    }
  }

  const inviteeTimezone = config.inviteeTimezone || scheduleTz;

  const requestedDateKeys = enumerateDateKeys(config.startDate, config.endDate);
  const requestedDateSet = new Set(requestedDateKeys);

  const inviteeRangeStartUtc = fromZonedTime(`${config.startDate}T00:00:00`, inviteeTimezone);
  const inviteeRangeEndUtc = fromZonedTime(`${config.endDate}T23:59:59`, inviteeTimezone);

  const hostRangeStart = shiftDateKey(zonedDateKey(inviteeRangeStartUtc, scheduleTz), -1);
  const hostRangeEnd = shiftDateKey(zonedDateKey(inviteeRangeEndUtc, scheduleTz), 1);

  // 3. Load availability overrides for the date range
  const { data: overrides } = await supabase
    .from('availability_overrides')
    .select('date, start_time, end_time, is_available')
    .eq('user_id', eventType.user_id)
    .gte('date', hostRangeStart)
    .lte('date', hostRangeEnd);

  // 4. Load existing active bookings (with buffer range)
  const rangeStart = fromZonedTime(`${hostRangeStart}T00:00:00`, scheduleTz);
  const rangeEnd = fromZonedTime(`${hostRangeEnd}T23:59:59`, scheduleTz);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('effective_block_start, effective_block_end, start_at')
    .eq('host_user_id', eventType.user_id)
    .in('status', ['confirmed', 'pending'])
    .lte('effective_block_start', rangeEnd.toISOString())
    .gte('effective_block_end', rangeStart.toISOString());

  // 4b. Load synced external calendar events (busy/out_of_office only)
  const { data: syncedEvents } = await supabase
    .from('synced_events')
    .select('start_at, end_at')
    .eq('user_id', eventType.user_id)
    .in('status', ['busy', 'out_of_office'])
    .lte('start_at', rangeEnd.toISOString())
    .gte('end_at', rangeStart.toISOString());

  // Count bookings per day and per week for limits
  const dailyCounts = new Map<string, number>();
  const weeklyCounts = new Map<string, number>();

  if (bookings) {
    for (const b of bookings) {
      // Use host timezone for day/week counting
      const bookingDate = zonedDateKey(new Date(b.start_at), scheduleTz);
      dailyCounts.set(bookingDate, (dailyCounts.get(bookingDate) || 0) + 1);
      const weekKey = getWeekKey(new Date(b.start_at), scheduleTz);
      weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);
    }
  }

  // 5. Generate slots for each day
  const duration = eventType.duration_minutes;
  const interval = eventType.slot_interval_minutes || duration;
  const bufferBefore = eventType.buffer_before_minutes || 0;
  const bufferAfter = eventType.buffer_after_minutes || 0;
  const minNoticeMs = (eventType.min_notice_hours || 0) * 60 * 60 * 1000;
  const maxDaysAdvance = eventType.max_days_in_advance || 60;
  const now = Date.now();
  const maxBookableAtMs = now + maxDaysAdvance * 24 * 60 * 60 * 1000;

  type OverrideRow = { date: string; start_time: string | null; end_time: string | null; is_available: boolean };
  const overrideMap = new Map<string, OverrideRow[]>();
  if (overrides) {
    for (const o of overrides) {
      const dateKey = o.date;
      if (!overrideMap.has(dateKey)) overrideMap.set(dateKey, []);
      overrideMap.get(dateKey)!.push(o);
    }
  }

  const slotsByInviteeDate = new Map<string, TimeSlot[]>();

  for (const hostDateKey of enumerateDateKeys(hostRangeStart, hostRangeEnd)) {
    // Check daily limit
    if (eventType.daily_limit != null) {
      const count = dailyCounts.get(hostDateKey) || 0;
      if (count >= eventType.daily_limit) {
        continue;
      }
    }

    // Check weekly limit
    if (eventType.weekly_limit != null) {
      const weekKey = getWeekKey(new Date(`${hostDateKey}T12:00:00Z`), scheduleTz);
      const count = weeklyCounts.get(weekKey) || 0;
      if (count >= eventType.weekly_limit) {
        continue;
      }
    }

    // Resolve availability windows for this day
    const windows = resolveAvailabilityWindows(
      hostDateKey,
      new Date(`${hostDateKey}T12:00:00Z`).getUTCDay(),
      rules,
      overrideMap.get(hostDateKey) || []
    );

    if (windows.length === 0) {
      continue;
    }

    for (const window of windows) {
      let slotStartMin = window.start;

      while (slotStartMin + duration <= window.end) {
        if (
          slotStartMin < window.start ||
          slotStartMin + duration > window.end
        ) {
          slotStartMin += interval;
          continue;
        }

        // Convert to absolute timestamps in the schedule timezone
        const slotStart = zonedMinutesToUtc(hostDateKey, slotStartMin, scheduleTz);
        const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
        const blockStart = new Date(slotStart.getTime() - bufferBefore * 60 * 1000);
        const blockEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000);

        // Check min notice
        if (slotStart.getTime() - now < minNoticeMs || slotStart.getTime() > maxBookableAtMs) {
          slotStartMin += interval;
          continue;
        }

        // Check overlap with existing bookings
        let overlaps = false;
        if (bookings) {
          for (const b of bookings) {
            const bStart = new Date(b.effective_block_start).getTime();
            const bEnd = new Date(b.effective_block_end).getTime();
            if (blockStart.getTime() < bEnd && blockEnd.getTime() > bStart) {
              overlaps = true;
              break;
            }
          }
        }

        // Check overlap with synced external calendar events (respect buffers)
        if (!overlaps && syncedEvents) {
          for (const se of syncedEvents) {
            const seStart = new Date(se.start_at).getTime();
            const seEnd = new Date(se.end_at).getTime();
            if (blockStart.getTime() < seEnd && blockEnd.getTime() > seStart) {
              overlaps = true;
              break;
            }
          }
        }

        if (!overlaps) {
          const inviteeDateKey = zonedDateKey(slotStart, inviteeTimezone);
          if (!requestedDateSet.has(inviteeDateKey)) {
            slotStartMin += interval;
            continue;
          }

          const existingSlots = slotsByInviteeDate.get(inviteeDateKey) || [];
          existingSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
          slotsByInviteeDate.set(inviteeDateKey, existingSlots);
        }

        slotStartMin += interval;
      }
    }
  }

  return requestedDateKeys.flatMap((dateKey) => {
    const slots = slotsByInviteeDate.get(dateKey);
    if (!slots || slots.length === 0) return [];

    slots.sort((a, b) => a.start.localeCompare(b.start));
    return [{ date: dateKey, slots }];
  });
}

/**
 * Resolve availability windows for a specific date using override semantics:
 * 1. Full-day block (is_available=false, no times) → []
 * 2. Replacement windows (is_available=true) → use those instead of weekly rules
 * 3. No is_available=true overrides → use weekly rules
 * 4. Subtract partial blocks from result
 */
function resolveAvailabilityWindows(
  _dateStr: string,
  dayOfWeek: number,
  rules: { day_of_week: number; start_time: string; end_time: string }[],
  dayOverrides: { start_time: string | null; end_time: string | null; is_available: boolean }[]
): TimeWindow[] {
  // Check for full-day block
  const hasFullDayBlock = dayOverrides.some(
    (o) => !o.is_available && o.start_time == null && o.end_time == null
  );
  if (hasFullDayBlock) return [];

  // Check for replacement windows
  const replacementWindows = dayOverrides.filter(
    (o) => o.is_available && o.start_time != null && o.end_time != null
  );

  let windows: TimeWindow[];

  if (replacementWindows.length > 0) {
    // Use replacement windows instead of weekly rules
    windows = replacementWindows.map((o) => ({
      start: timeToMinutes(o.start_time!),
      end: timeToMinutes(o.end_time!),
    }));
  } else {
    // Use weekly rules for this day
    windows = rules
      .filter((r) => r.day_of_week === dayOfWeek)
      .map((r) => ({
        start: timeToMinutes(r.start_time),
        end: timeToMinutes(r.end_time),
      }));
  }

  // Subtract partial blocks
  const partialBlocks = dayOverrides.filter(
    (o) => !o.is_available && o.start_time != null && o.end_time != null
  );

  for (const block of partialBlocks) {
    const blockStart = timeToMinutes(block.start_time!);
    const blockEnd = timeToMinutes(block.end_time!);
    windows = subtractBlock(windows, blockStart, blockEnd);
  }

  return windows.filter((w) => w.end > w.start);
}

/** Subtract a time block from a list of windows */
function subtractBlock(windows: TimeWindow[], blockStart: number, blockEnd: number): TimeWindow[] {
  const result: TimeWindow[] = [];
  for (const w of windows) {
    if (blockEnd <= w.start || blockStart >= w.end) {
      // No overlap
      result.push(w);
    } else {
      // Overlap — split
      if (blockStart > w.start) {
        result.push({ start: w.start, end: blockStart });
      }
      if (blockEnd < w.end) {
        result.push({ start: blockEnd, end: w.end });
      }
    }
  }
  return result;
}

/** Convert "HH:MM" or "HH:MM:SS" to minutes from midnight */
function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

/** Convert date + minutes-from-midnight in a timezone to a UTC Date */
function zonedMinutesToUtc(dateStr: string, minutes: number, timezone: string): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return fromZonedTime(
    `${dateStr}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`,
    timezone
  );
}

/** Get the date string (YYYY-MM-DD) for a Date in a specific timezone */
function zonedDateKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/** Get Sunday-based week key (week start date) for a date in a timezone */
function getWeekKey(date: Date, timezone: string): string {
  const dateStr = zonedDateKey(date, timezone);
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function enumerateDateKeys(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function shiftDateKey(dateStr: string, deltaDays: number): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}
