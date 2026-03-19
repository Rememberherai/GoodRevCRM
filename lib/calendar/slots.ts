/**
 * Slot calculation engine — computes available booking slots for an event type.
 *
 * Supports three scheduling modes:
 * - one_on_one / group: single host availability
 * - round_robin: UNION of all team members' availability (at least one free)
 * - collective: INTERSECTION of all team members' availability (all must be free)
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

type OverrideRow = { date: string; start_time: string | null; end_time: string | null; is_available: boolean };
type BookingRow = { effective_block_start: string; effective_block_end: string; start_at: string };
type SyncedEventRow = { start_at: string; end_at: string };

interface UserAvailabilityData {
  rules: { day_of_week: number; start_time: string; end_time: string }[];
  scheduleTz: string;
  overrides: OverrideRow[];
  bookings: BookingRow[];
  syncedEvents: SyncedEventRow[];
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

  const schedulingType = eventType.scheduling_type || 'one_on_one';

  // Determine which users to compute availability for
  let memberUserIds: string[] = [eventType.user_id];

  if (schedulingType === 'round_robin' || schedulingType === 'collective') {
    const { data: members } = await supabase
      .from('event_type_members')
      .select('user_id')
      .eq('event_type_id', eventType.id)
      .eq('is_active', true);

    if (members && members.length > 0) {
      memberUserIds = members.map((m) => m.user_id);
    }
    // If no active members, fall back to event type owner only
  }

  // 2. Load availability data for the event type's schedule (shared config)
  const scheduleId = eventType.schedule_id;
  let baseRules: { day_of_week: number; start_time: string; end_time: string }[] = [];
  let baseScheduleTz = 'America/New_York';

  if (scheduleId) {
    const { data: schedule } = await supabase
      .from('availability_schedules')
      .select('timezone')
      .eq('id', scheduleId)
      .single();

    if (schedule) baseScheduleTz = schedule.timezone;

    const { data: scheduleRules } = await supabase
      .from('availability_rules')
      .select('day_of_week, start_time, end_time')
      .eq('schedule_id', scheduleId);

    if (scheduleRules) baseRules = scheduleRules;
  } else {
    const { data: defaultSchedule } = await supabase
      .from('availability_schedules')
      .select('id, timezone')
      .eq('user_id', eventType.user_id)
      .eq('is_default', true)
      .single();

    if (defaultSchedule) {
      baseScheduleTz = defaultSchedule.timezone;
      const { data: defaultRules } = await supabase
        .from('availability_rules')
        .select('day_of_week, start_time, end_time')
        .eq('schedule_id', defaultSchedule.id);

      if (defaultRules) baseRules = defaultRules;
    }
  }

  const inviteeTimezone = config.inviteeTimezone || baseScheduleTz;

  const requestedDateKeys = enumerateDateKeys(config.startDate, config.endDate);
  const requestedDateSet = new Set(requestedDateKeys);

  const inviteeRangeStartUtc = fromZonedTime(`${config.startDate}T00:00:00`, inviteeTimezone);
  const inviteeRangeEndUtc = fromZonedTime(`${config.endDate}T23:59:59`, inviteeTimezone);

  const hostRangeStart = shiftDateKey(zonedDateKey(inviteeRangeStartUtc, baseScheduleTz), -1);
  const hostRangeEnd = shiftDateKey(zonedDateKey(inviteeRangeEndUtc, baseScheduleTz), 1);

  const rangeStart = fromZonedTime(`${hostRangeStart}T00:00:00`, baseScheduleTz);
  const rangeEnd = fromZonedTime(`${hostRangeEnd}T23:59:59`, baseScheduleTz);

  // 3. Load per-user availability data
  const userDataMap = new Map<string, UserAvailabilityData>();

  for (const userId of memberUserIds) {
    // For team members, load their own schedule if they have one; otherwise use the event type's schedule
    let userRules = baseRules;
    let userScheduleTz = baseScheduleTz;

    if (userId !== eventType.user_id) {
      // Try the member's default schedule
      const { data: memberSchedule } = await supabase
        .from('availability_schedules')
        .select('id, timezone')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      if (memberSchedule) {
        userScheduleTz = memberSchedule.timezone;
        const { data: memberRules } = await supabase
          .from('availability_rules')
          .select('day_of_week, start_time, end_time')
          .eq('schedule_id', memberSchedule.id);

        if (memberRules) userRules = memberRules;
      }
    }

    const { data: overrides } = await supabase
      .from('availability_overrides')
      .select('date, start_time, end_time, is_available')
      .eq('user_id', userId)
      .gte('date', hostRangeStart)
      .lte('date', hostRangeEnd);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('effective_block_start, effective_block_end, start_at')
      .eq('host_user_id', userId)
      .in('status', ['confirmed', 'pending'])
      .lte('effective_block_start', rangeEnd.toISOString())
      .gte('effective_block_end', rangeStart.toISOString());

    const { data: syncedEvents } = await supabase
      .from('synced_events')
      .select('start_at, end_at')
      .eq('user_id', userId)
      .in('status', ['busy', 'out_of_office'])
      .lte('start_at', rangeEnd.toISOString())
      .gte('end_at', rangeStart.toISOString());

    userDataMap.set(userId, {
      rules: userRules,
      scheduleTz: userScheduleTz,
      overrides: overrides || [],
      bookings: bookings || [],
      syncedEvents: syncedEvents || [],
    });
  }

  // 4. Generate slots
  const duration = eventType.duration_minutes;
  const interval = eventType.slot_interval_minutes || duration;
  const bufferBefore = eventType.buffer_before_minutes || 0;
  const bufferAfter = eventType.buffer_after_minutes || 0;
  const minNoticeMs = (eventType.min_notice_hours || 0) * 60 * 60 * 1000;
  const maxDaysAdvance = eventType.max_days_in_advance || 60;
  const now = Date.now();
  const maxBookableAtMs = now + maxDaysAdvance * 24 * 60 * 60 * 1000;

  // Use the event type owner's data for daily/weekly limits and schedule-based iteration
  const ownerData = userDataMap.get(eventType.user_id) || userDataMap.values().next().value!;

  // Count bookings per day and per week for limits (based on owner's timezone)
  const dailyCounts = new Map<string, number>();
  const weeklyCounts = new Map<string, number>();

  // For limits, count ALL team members' bookings (capacity is per-event-type, not per-member)
  for (const userData of userDataMap.values()) {
    for (const b of userData.bookings) {
      const bookingDate = zonedDateKey(new Date(b.start_at), baseScheduleTz);
      dailyCounts.set(bookingDate, (dailyCounts.get(bookingDate) || 0) + 1);
      const weekKey = getWeekKey(new Date(b.start_at), baseScheduleTz);
      weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) || 0) + 1);
    }
  }

  // Build override maps per user
  const userOverrideMaps = new Map<string, Map<string, OverrideRow[]>>();
  for (const [userId, userData] of userDataMap) {
    const overrideMap = new Map<string, OverrideRow[]>();
    for (const o of userData.overrides) {
      if (!overrideMap.has(o.date)) overrideMap.set(o.date, []);
      overrideMap.get(o.date)!.push(o);
    }
    userOverrideMaps.set(userId, overrideMap);
  }

  const slotsByInviteeDate = new Map<string, TimeSlot[]>();

  for (const hostDateKey of enumerateDateKeys(hostRangeStart, hostRangeEnd)) {
    // Check daily limit
    if (eventType.daily_limit != null) {
      const count = dailyCounts.get(hostDateKey) || 0;
      if (count >= eventType.daily_limit) continue;
    }

    // Check weekly limit
    if (eventType.weekly_limit != null) {
      const weekKey = getWeekKey(new Date(`${hostDateKey}T12:00:00Z`), baseScheduleTz);
      const count = weeklyCounts.get(weekKey) || 0;
      if (count >= eventType.weekly_limit) continue;
    }

    // Generate candidate slots from the owner's schedule (or base schedule)
    const ownerOverrideMap = userOverrideMaps.get(eventType.user_id) || userOverrideMaps.values().next().value!;
    const ownerWindows = resolveAvailabilityWindows(
      hostDateKey,
      new Date(`${hostDateKey}T12:00:00Z`).getUTCDay(),
      ownerData.rules,
      ownerOverrideMap.get(hostDateKey) || []
    );

    // For team scheduling, resolve each member's windows
    let memberWindowSets: Map<string, TimeWindow[]> | null = null;
    if (schedulingType === 'round_robin' || schedulingType === 'collective') {
      memberWindowSets = new Map();
      for (const [userId, userData] of userDataMap) {
        const userOverrideMap = userOverrideMaps.get(userId)!;
        const windows = resolveAvailabilityWindows(
          hostDateKey,
          new Date(`${hostDateKey}T12:00:00Z`).getUTCDay(),
          userData.rules,
          userOverrideMap.get(hostDateKey) || []
        );
        memberWindowSets.set(userId, windows);
      }
    }

    // Determine which windows to iterate over for slot generation
    let candidateWindows: TimeWindow[];
    if (schedulingType === 'collective' && memberWindowSets) {
      // Intersect all members' windows
      candidateWindows = intersectAllWindows([...memberWindowSets.values()]);
    } else if (schedulingType === 'round_robin' && memberWindowSets) {
      // Union all members' windows
      candidateWindows = unionAllWindows([...memberWindowSets.values()]);
    } else {
      candidateWindows = ownerWindows;
    }

    if (candidateWindows.length === 0) continue;

    for (const window of candidateWindows) {
      let slotStartMin = window.start;

      while (slotStartMin + duration <= window.end) {
        const slotStart = zonedMinutesToUtc(hostDateKey, slotStartMin, baseScheduleTz);
        const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
        const blockStart = new Date(slotStart.getTime() - bufferBefore * 60 * 1000);
        const blockEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000);

        // Check min notice
        if (slotStart.getTime() - now < minNoticeMs || slotStart.getTime() > maxBookableAtMs) {
          slotStartMin += interval;
          continue;
        }

        // Check overlap based on scheduling type
        let slotAvailable: boolean;

        if (schedulingType === 'round_robin' && memberWindowSets) {
          // At least one member must be free AND within their own availability window
          slotAvailable = false;
          for (const [userId, userData] of userDataMap) {
            // Check the member's own availability windows for this day
            const memberWindows = memberWindowSets.get(userId) || [];
            const slotInWindow = memberWindows.some(
              (w) => slotStartMin >= w.start && slotStartMin + duration <= w.end
            );
            if (slotInWindow && !hasOverlap(blockStart, blockEnd, userData.bookings, userData.syncedEvents)) {
              slotAvailable = true;
              break;
            }
          }
        } else if (schedulingType === 'collective') {
          // ALL members must be free
          slotAvailable = true;
          for (const userData of userDataMap.values()) {
            if (hasOverlap(blockStart, blockEnd, userData.bookings, userData.syncedEvents)) {
              slotAvailable = false;
              break;
            }
          }
        } else {
          // one_on_one / group — single host
          slotAvailable = !hasOverlap(blockStart, blockEnd, ownerData.bookings, ownerData.syncedEvents);
        }

        if (slotAvailable) {
          const inviteeDateKey = zonedDateKey(slotStart, inviteeTimezone);
          if (requestedDateSet.has(inviteeDateKey)) {
            const existingSlots = slotsByInviteeDate.get(inviteeDateKey) || [];
            existingSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            });
            slotsByInviteeDate.set(inviteeDateKey, existingSlots);
          }
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

// ============================================================
// Helpers
// ============================================================

/** Check if a block overlaps with any bookings or synced events */
function hasOverlap(
  blockStart: Date,
  blockEnd: Date,
  bookings: BookingRow[],
  syncedEvents: SyncedEventRow[]
): boolean {
  const bsMs = blockStart.getTime();
  const beMs = blockEnd.getTime();

  for (const b of bookings) {
    const bStart = new Date(b.effective_block_start).getTime();
    const bEnd = new Date(b.effective_block_end).getTime();
    if (bsMs < bEnd && beMs > bStart) return true;
  }

  for (const se of syncedEvents) {
    const seStart = new Date(se.start_at).getTime();
    const seEnd = new Date(se.end_at).getTime();
    if (bsMs < seEnd && beMs > seStart) return true;
  }

  return false;
}

/** Intersect multiple sets of time windows — result is time where ALL sets overlap */
function intersectAllWindows(windowSets: TimeWindow[][]): TimeWindow[] {
  if (windowSets.length === 0) return [];
  const [firstWindowSet, ...remainingWindowSets] = windowSets;
  if (!firstWindowSet) return [];

  let result = firstWindowSet;
  for (const windowSet of remainingWindowSets) {
    result = intersectWindows(result, windowSet);
    if (result.length === 0) return [];
  }
  return result;
}

/** Intersect two sorted lists of time windows */
function intersectWindows(a: TimeWindow[], b: TimeWindow[]): TimeWindow[] {
  const result: TimeWindow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const aWindow = a[i];
    const bWindow = b[j];
    if (!aWindow || !bWindow) break;

    const start = Math.max(aWindow.start, bWindow.start);
    const end = Math.min(aWindow.end, bWindow.end);
    if (start < end) {
      result.push({ start, end });
    }
    // Advance the window that ends first; advance both if equal
    if (aWindow.end < bWindow.end) i++;
    else if (aWindow.end > bWindow.end) j++;
    else { i++; j++; }
  }
  return result;
}

/** Union multiple sets of time windows — result is time where ANY set has availability */
function unionAllWindows(windowSets: TimeWindow[][]): TimeWindow[] {
  const allWindows: TimeWindow[] = windowSets.flat();
  if (allWindows.length === 0) return [];

  // Sort by start time
  allWindows.sort((a, b) => a.start - b.start);

  // Merge overlapping
  const [firstWindow, ...restWindows] = allWindows;
  if (!firstWindow) return [];

  const merged: TimeWindow[] = [{ ...firstWindow }];
  for (const window of restWindows) {
    const last = merged[merged.length - 1];
    if (!last) continue;

    if (window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }
  return merged;
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
    windows = replacementWindows.map((o) => ({
      start: timeToMinutes(o.start_time!),
      end: timeToMinutes(o.end_time!),
    }));
  } else {
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
      result.push(w);
    } else {
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
