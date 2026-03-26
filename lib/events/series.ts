/**
 * Event series service — recurrence generation, series management.
 *
 * Uses the `rrule` library for RFC 5545 recurrence rule expansion.
 * All functions create their own service clients internally.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { RRule, RRuleSet, Weekday } from 'rrule';
import { fromZonedTime } from 'date-fns-tz';
import { generateSlug } from '@/lib/validation-helpers';
import type { Database, Json } from '@/types/database';
import crypto from 'crypto';

// ============================================================
// Helpers
// ============================================================

const DAY_MAP: Record<string, Weekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const FREQ_MAP: Record<string, number> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  biweekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
};

type ServiceClient = ReturnType<typeof createServiceClient>;
type EventSeriesRow = Database['public']['Tables']['event_series']['Row'];
type EventInsert = Database['public']['Tables']['events']['Insert'];

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0] || '0', 10),
    minutes: parseInt(parts[1] || '0', 10),
  };
}

function toUtcIso(dateStr: string, hours: number, minutes: number, timezone?: string | null): string {
  const tz = timezone || 'America/Denver';
  const localTimestamp =
    `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  return fromZonedTime(localTimestamp, tz).toISOString();
}

function formatDateInTimezone(isoDate: string, timezone?: string | null): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoDate));
}

function asRuleDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00.000Z`);
}

function buildSeriesOccurrenceDateStrings(params: {
  series: Pick<EventSeriesRow, 'generation_horizon_days' | 'recurrence_count' | 'recurrence_day_positions' | 'recurrence_days_of_week' | 'recurrence_frequency' | 'recurrence_interval' | 'recurrence_until'>;
  startDateStr: string;
  endDateStr?: string;
  countOverride?: number | null;
}): string[] {
  const freq = FREQ_MAP[params.series.recurrence_frequency] ?? RRule.WEEKLY;
  const interval = params.series.recurrence_frequency === 'biweekly'
    ? 2
    : (params.series.recurrence_interval ?? 1);

  const dayPositions = (params.series.recurrence_day_positions as number[] | null) ?? [];
  const days = (params.series.recurrence_days_of_week as string[] || []);

  // For monthly with day positions (e.g. 1st+3rd Monday), create a weekday entry
  // for each (day, position) combination so RRule generates all of them.
  const byweekday: Weekday[] = [];
  if (params.series.recurrence_frequency === 'monthly' && dayPositions.length > 0) {
    for (const d of days) {
      const day = DAY_MAP[d];
      if (!day) continue;
      for (const pos of dayPositions) {
        byweekday.push(day.nth(pos === 5 ? -1 : pos));
      }
    }
  } else {
    for (const d of days) {
      const day = DAY_MAP[d];
      if (day) byweekday.push(day);
    }
  }

  const horizonEnd = params.endDateStr
    ? asRuleDate(params.endDateStr)
    : params.series.recurrence_until
      ? asRuleDate(params.series.recurrence_until)
      : (() => {
        const date = new Date();
        date.setDate(date.getDate() + (params.series.generation_horizon_days ?? 90));
        return date;
      })();

  const ruleOptions: Partial<ConstructorParameters<typeof RRule>[0]> = {
    freq,
    interval,
    dtstart: asRuleDate(params.startDateStr),
    until: horizonEnd,
    byweekday: byweekday.length > 0 ? byweekday : undefined,
  };

  const count = params.countOverride ?? params.series.recurrence_count;
  if (count) {
    ruleOptions.count = count;
    delete ruleOptions.until;
  }

  const rruleSet = new RRuleSet();
  rruleSet.rrule(new RRule(ruleOptions as ConstructorParameters<typeof RRule>[0]));
  return rruleSet.all().map((date) => date.toISOString().split('T')[0]).filter((date): date is string => Boolean(date));
}

export interface SeriesTicketTemplate {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  quantity_available: number | null;
  max_per_order: number;
  sort_order: number;
  sales_start_at: string | null;
  sales_end_at: string | null;
  is_active: boolean;
  is_hidden: boolean;
}

interface SeriesTicketSelection {
  ticket_type_id: string;
  quantity: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function serializeSeriesTicketTemplates(
  ticketTypes: Array<{
    id?: string;
    name: string;
    description?: string | null;
    price_cents?: number;
    quantity_available?: number | null;
    max_per_order?: number;
    sort_order?: number;
    sales_start_at?: string | null;
    sales_end_at?: string | null;
    is_active?: boolean;
    is_hidden?: boolean;
  }>,
  existingTemplates: SeriesTicketTemplate[] = []
): SeriesTicketTemplate[] {
  return ticketTypes.map((ticketType, index) => ({
    id: ticketType.id ?? existingTemplates[index]?.id ?? crypto.randomUUID(),
    name: ticketType.name,
    description: ticketType.description ?? null,
    price_cents: ticketType.price_cents ?? 0,
    currency: 'usd',
    quantity_available: ticketType.quantity_available ?? null,
    max_per_order: ticketType.max_per_order ?? 10,
    sort_order: ticketType.sort_order ?? index,
    sales_start_at: ticketType.sales_start_at ?? null,
    sales_end_at: ticketType.sales_end_at ?? null,
    is_active: ticketType.is_active ?? true,
    is_hidden: ticketType.is_hidden ?? false,
  }));
}

export function parseSeriesTicketTemplates(value: Json | null | undefined): SeriesTicketTemplate[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return [];

    return [{
      id: item.id,
      name: item.name,
      description: typeof item.description === 'string' ? item.description : null,
      price_cents: typeof item.price_cents === 'number' ? item.price_cents : 0,
      currency: typeof item.currency === 'string' ? item.currency : 'usd',
      quantity_available: typeof item.quantity_available === 'number' ? item.quantity_available : null,
      max_per_order: typeof item.max_per_order === 'number' ? item.max_per_order : 10,
      sort_order: typeof item.sort_order === 'number' ? item.sort_order : 0,
      sales_start_at: typeof item.sales_start_at === 'string' ? item.sales_start_at : null,
      sales_end_at: typeof item.sales_end_at === 'string' ? item.sales_end_at : null,
      is_active: typeof item.is_active === 'boolean' ? item.is_active : true,
      is_hidden: typeof item.is_hidden === 'boolean' ? item.is_hidden : false,
    }];
  });
}

function parseStoredSeriesSelections(responses: Json | null | undefined): SeriesTicketSelection[] {
  if (!isObject(responses)) return [];
  const raw = responses.ticket_selections;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!isObject(item) || typeof item.ticket_type_id !== 'string' || typeof item.quantity !== 'number') return [];
    return [{ ticket_type_id: item.ticket_type_id, quantity: item.quantity }];
  });
}

async function syncEventTicketTypesFromSeriesTemplates(params: {
  supabase: ReturnType<typeof createServiceClient>;
  eventId: string;
  templates: SeriesTicketTemplate[];
}): Promise<string | null> {
  const { error: deleteError } = await params.supabase
    .from('event_ticket_types')
    .delete()
    .eq('event_id', params.eventId);
  if (deleteError) return deleteError.message;

  if (params.templates.length === 0) return null;

  const { error: insertError } = await params.supabase
    .from('event_ticket_types')
    .insert(params.templates.map((template) => ({
      event_id: params.eventId,
      name: template.name,
      description: template.description,
      price_cents: template.price_cents,
      currency: template.currency,
      quantity_available: template.quantity_available,
      max_per_order: template.max_per_order,
      sort_order: template.sort_order,
      sales_start_at: template.sales_start_at,
      sales_end_at: template.sales_end_at,
      is_active: template.is_active,
      is_hidden: template.is_hidden,
    })));
  if (insertError) return insertError.message;

  return null;
}

async function registerSeriesSelectionForEvent(params: {
  supabase: ReturnType<typeof createServiceClient>;
  eventId: string;
  selections: SeriesTicketSelection[];
  templateMap: Map<string, SeriesTicketTemplate>;
  registrantName: string;
  registrantEmail: string;
  registrantPhone: string | null;
  responses: Record<string, unknown>;
  source: string | null;
}) {
  const { data: eventTicketTypes } = await params.supabase
    .from('event_ticket_types')
    .select('id, name, sort_order')
    .eq('event_id', params.eventId);

  const ticketSelections = params.selections.flatMap((selection) => {
    const template = params.templateMap.get(selection.ticket_type_id);
    if (!template) return [];

    const eventTicketType = (eventTicketTypes ?? []).find((ticketType) =>
      ticketType.name === template.name && ticketType.sort_order === template.sort_order
    );

    if (!eventTicketType) return [];

    return [{
      ticket_type_id: eventTicketType.id,
      quantity: selection.quantity,
    }];
  });

  if (ticketSelections.length === 0) {
    return { registrationId: null as string | null, error: 'No matching ticket types found on instance' };
  }

  const { data: registrationId, error } = await params.supabase.rpc('register_for_event', {
    p_event_id: params.eventId,
    p_registrant_name: params.registrantName,
    p_registrant_email: params.registrantEmail,
    p_registrant_phone: params.registrantPhone ?? '',
    p_ticket_selections: ticketSelections as unknown as Json,
    p_responses: params.responses as unknown as Json,
    p_source: params.source ?? 'web',
    p_ip_address: '',
    p_user_agent: 'series-registration',
  });

  if (error) {
    return { registrationId: null as string | null, error: error.message || 'Registration failed' };
  }

  return { registrationId: registrationId as string, error: null as string | null };
}

async function syncActiveSeriesRegistrationsToEvent(params: {
  supabase: ReturnType<typeof createServiceClient>;
  seriesId: string;
  eventId: string;
  ticketTemplates: SeriesTicketTemplate[];
}) {
  if (params.ticketTemplates.length === 0) return;

  const templateMap = new Map(params.ticketTemplates.map((template) => [template.id, template]));

  const { data: seriesRegistrations } = await params.supabase
    .from('event_series_registrations')
    .select('id, person_id, registrant_name, registrant_email, registrant_phone, responses, source')
    .eq('series_id', params.seriesId)
    .eq('status', 'active');

  for (const seriesRegistration of seriesRegistrations ?? []) {
    const storedSelections = parseStoredSeriesSelections(seriesRegistration.responses);
    if (storedSelections.length === 0) continue;

    const result = await registerSeriesSelectionForEvent({
      supabase: params.supabase,
      eventId: params.eventId,
      selections: storedSelections,
      templateMap,
      registrantName: seriesRegistration.registrant_name,
      registrantEmail: seriesRegistration.registrant_email,
      registrantPhone: seriesRegistration.registrant_phone,
      responses: isObject(seriesRegistration.responses) ? seriesRegistration.responses : {},
      source: seriesRegistration.source,
    });

    if (result.registrationId) {
      const registrationUpdate: Record<string, unknown> = {
        series_registration_id: seriesRegistration.id,
      };
      if (seriesRegistration.person_id) {
        registrationUpdate.person_id = seriesRegistration.person_id;
      }

      await params.supabase
        .from('event_registrations')
        .update(registrationUpdate)
        .eq('id', result.registrationId);
    } else if (result.error) {
      console.error(`Failed to register series participant ${seriesRegistration.id} for new event ${params.eventId}:`, result.error);
    }
  }
}

async function createSeriesInstance(params: {
  supabase: ServiceClient;
  series: EventSeriesRow;
  seriesId: string;
  seriesIndex: number;
  dateStr: string;
  ticketTemplates: SeriesTicketTemplate[];
}): Promise<boolean> {
  const startTime = parseTime(params.series.template_start_time as string);
  const endTime = parseTime(params.series.template_end_time as string);
  const startsAtStr = toUtcIso(params.dateStr, startTime.hours, startTime.minutes, params.series.timezone);
  const endsAtStr = toUtcIso(params.dateStr, endTime.hours, endTime.minutes, params.series.timezone);
  const baseSlug = generateSlug(`${params.series.title}-${params.dateStr}`);

  const buildInsert = (slug: string): EventInsert => ({
    project_id: params.series.project_id,
    program_id: params.series.program_id,
    series_id: params.seriesId,
    series_index: params.seriesIndex,
    created_by: params.series.created_by,
    title: params.series.title,
    slug,
    description: params.series.description,
    description_html: params.series.description_html,
    cover_image_url: params.series.cover_image_url,
    category: params.series.category,
    tags: params.series.tags as string[],
    starts_at: startsAtStr,
    ends_at: endsAtStr,
    timezone: params.series.timezone,
    location_type: params.series.location_type as 'in_person' | 'virtual' | 'hybrid',
    venue_name: params.series.venue_name,
    venue_address: params.series.venue_address,
    venue_latitude: params.series.venue_latitude,
    venue_longitude: params.series.venue_longitude,
    virtual_url: params.series.virtual_url,
    registration_enabled: params.series.registration_enabled,
    total_capacity: params.series.total_capacity,
    waitlist_enabled: params.series.waitlist_enabled,
    max_tickets_per_registration: params.series.max_tickets_per_registration,
    require_approval: params.series.require_approval,
    custom_questions: params.series.custom_questions,
    visibility: params.series.visibility as 'public' | 'unlisted' | 'private',
    confirmation_message: params.series.confirmation_message,
    cancellation_policy: params.series.cancellation_policy,
    requires_waiver: false,
    organizer_name: params.series.organizer_name,
    organizer_email: params.series.organizer_email,
    status: 'published',
  });

  let createdEventId: string | null = null;

  const { data: createdEvent, error: insertError } = await params.supabase
    .from('events')
    .insert(buildInsert(baseSlug))
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('Failed to create series instance:', insertError.message);
      return false;
    }

    const { data: retriedEvent, error: retryError } = await params.supabase
      .from('events')
      .insert(buildInsert(`${baseSlug}-${params.seriesIndex}`))
      .select('id')
      .single();

    if (retryError || !retriedEvent?.id) {
      console.error('Failed to create series instance (retry):', retryError?.message ?? 'Unknown error');
      return false;
    }

    createdEventId = retriedEvent.id;
  } else if (createdEvent?.id) {
    createdEventId = createdEvent.id;
  }

  if (!createdEventId) return false;

  const ticketSyncError = await syncEventTicketTypesFromSeriesTemplates({
    supabase: params.supabase,
    eventId: createdEventId,
    templates: params.ticketTemplates,
  });

  if (ticketSyncError) {
    console.error('Failed to sync ticket types for series instance:', ticketSyncError);
    await params.supabase
      .from('events')
      .delete()
      .eq('id', createdEventId);
    return false;
  }

  await syncActiveSeriesRegistrationsToEvent({
    supabase: params.supabase,
    seriesId: params.seriesId,
    eventId: createdEventId,
    ticketTemplates: params.ticketTemplates,
  });

  return true;
}

// ============================================================
// Generate instances from series
// ============================================================

/**
 * Generate event instances for a series within a date range.
 * Returns the count of instances generated.
 */
export async function generateSeriesInstances(
  seriesId: string,
  fromDate?: string,
  toDate?: string
): Promise<number> {
  const supabase = createServiceClient();

  // Load series template
  const { data: series, error: seriesError } = await supabase
    .from('event_series')
    .select('*')
    .eq('id', seriesId)
    .single();

  if (seriesError || !series) {
    console.error('generateSeriesInstances: series not found', seriesId);
    return 0;
  }

  // Calculate date range — start from day AFTER last_generated_date to avoid re-generating
  const start = fromDate
    ? new Date(fromDate)
    : series.last_generated_date
      ? (() => { const d = new Date(series.last_generated_date); d.setDate(d.getDate() + 1); return d; })()
      : new Date();

  // Default horizon: series.generation_horizon_days from today
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + (series.generation_horizon_days ?? 90));

  const end = toDate
    ? new Date(toDate)
    : series.recurrence_until
      ? new Date(Math.min(new Date(series.recurrence_until).getTime(), horizonEnd.getTime()))
      : horizonEnd;

  // Get existing instances to avoid duplicates and to enforce recurrence_count across cron runs.
  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, starts_at')
    .eq('series_id', seriesId);

  const existingInstanceCount = existingEvents?.length ?? 0;
  const remainingCount = series.recurrence_count
    ? Math.max(series.recurrence_count - existingInstanceCount, 0)
    : null;
  if (series.recurrence_count && remainingCount === 0) return 0;

  const dates = buildSeriesOccurrenceDateStrings({
    series,
    startDateStr: start.toISOString().split('T')[0] || formatDateInTimezone(start.toISOString(), series.timezone),
    endDateStr: end.toISOString().split('T')[0] || undefined,
    countOverride: remainingCount,
  });

  if (dates.length === 0) return 0;

  const existingDates = new Set(
    (existingEvents || []).map((e) => formatDateInTimezone(e.starts_at, series.timezone))
  );
  const ticketTemplates = parseSeriesTicketTemplates(series.ticket_types);

  // Filter to only new dates
  const newDates = dates.filter(d => d && !existingDates.has(d));
  if (newDates.length === 0) return 0;

  // Get current max series_index
  const { data: maxIndexResult } = await supabase
    .from('events')
    .select('series_index')
    .eq('series_id', seriesId)
    .order('series_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  let maxIndex = maxIndexResult?.series_index ?? 0;

  // Mark generation as in-progress
  await supabase.from('event_series').update({
    generation_status: 'generating',
    generation_progress: 0,
    generation_total: newDates.length,
  }).eq('id', seriesId);

  let count = 0;
  let lastCreatedDate: string | null = null;

  try {
    // Process in batches of 10 with progress updates
    const BATCH_SIZE = 10;
    for (let i = 0; i < newDates.length; i += BATCH_SIZE) {
      const batch = newDates.slice(i, i + BATCH_SIZE);
      const batchWithDates = batch.map((dateStr) => {
        if (!dateStr) return { dateStr, idx: 0, skip: true };
        return { dateStr, idx: ++maxIndex, skip: false };
      });
      const results = await Promise.all(
        batchWithDates.map(async ({ dateStr, idx, skip }) => {
          if (skip) return false;
          return createSeriesInstance({
            supabase,
            series,
            seriesId,
            seriesIndex: idx,
            dateStr,
            ticketTemplates,
          });
        })
      );

      // Track the last successfully created date from this batch
      for (let j = results.length - 1; j >= 0; j--) {
        const entry = batchWithDates[j];
        if (results[j] && entry) {
          lastCreatedDate = entry.dateStr;
          break;
        }
      }
      count += results.filter(Boolean).length;

      // Update progress
      await supabase.from('event_series').update({
        generation_progress: Math.min(i + BATCH_SIZE, newDates.length),
      }).eq('id', seriesId);
    }
  } catch (genErr) {
    console.error('Error during series instance generation:', genErr);
  }

  // Update last_generated_date and mark generation complete (always reset status even on partial failure)
  const { error: updateError } = await supabase
    .from('event_series')
    .update({
      ...(lastCreatedDate ? { last_generated_date: lastCreatedDate } : {}),
      generation_status: 'idle',
      generation_progress: 0,
      generation_total: 0,
    })
    .eq('id', seriesId);

  if (updateError) {
    console.error('Failed to update generation status for series', seriesId, ':', updateError.message);
  }

  return count;
}

export async function syncFutureSeriesInstances(params: {
  seriesId: string;
  previousSeries: EventSeriesRow;
  nextSeries: EventSeriesRow;
  dryRun?: boolean;
}): Promise<{ updated: number; created: number; deleted: number; error?: string }> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: existingEvents, error } = await supabase
    .from('events')
    .select('id, starts_at, ends_at, series_index, series_instance_modified')
    .eq('series_id', params.seriesId)
    .order('series_index', { ascending: true });

  if (error || !existingEvents || existingEvents.length === 0) {
    return { updated: 0, created: 0, deleted: 0 };
  }

  const anchorEvent = existingEvents.find((event) => typeof event.series_index === 'number');
  if (!anchorEvent) {
    return { updated: 0, created: 0, deleted: 0 };
  }

  const anchorDateStr = formatDateInTimezone(anchorEvent.starts_at, params.previousSeries.timezone);
  const occurrenceDateStrings = buildSeriesOccurrenceDateStrings({
    series: params.nextSeries,
    startDateStr: anchorDateStr,
  });

  const occurrenceByIndex = new Map(occurrenceDateStrings.map((dateStr, index) => [index + 1, dateStr]));
  const existingByIndex = new Map(
    existingEvents
      .filter((event) => typeof event.series_index === 'number')
      .map((event) => [event.series_index as number, event])
  );

  const futureUnmodifiedEvents = existingEvents.filter((event) =>
    event.starts_at > nowIso && !event.series_instance_modified && typeof event.series_index === 'number'
  );

  const obsoleteEventIds = futureUnmodifiedEvents
    .filter((event) => !occurrenceByIndex.has(event.series_index as number))
    .map((event) => event.id);

  if (obsoleteEventIds.length > 0) {
    const { count: obsoleteRegistrationCount } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .in('event_id', obsoleteEventIds)
      .neq('status', 'cancelled');

    if ((obsoleteRegistrationCount ?? 0) > 0) {
      return {
        updated: 0,
        created: 0,
        deleted: 0,
        error: 'Cannot remove future series instances created by this schedule change because registrations already exist on them.',
      };
    }

    if (!params.dryRun) {
      await supabase
        .from('events')
        .delete()
        .in('id', obsoleteEventIds);
    }
  }

  if (params.dryRun) {
    return {
      updated: futureUnmodifiedEvents.filter((event) => occurrenceByIndex.has(event.series_index as number)).length,
      created: occurrenceDateStrings.filter((_, index) => {
        const seriesIndex = index + 1;
        const existingEvent = existingByIndex.get(seriesIndex);
        if (existingEvent) return false;
        const startsAt = toUtcIso(
          occurrenceDateStrings[index]!,
          parseTime(params.nextSeries.template_start_time as string).hours,
          parseTime(params.nextSeries.template_start_time as string).minutes,
          params.nextSeries.timezone
        );
        return startsAt > nowIso;
      }).length,
      deleted: obsoleteEventIds.length,
    };
  }

  let updated = 0;
  let created = 0;
  const ticketTemplates = parseSeriesTicketTemplates(params.nextSeries.ticket_types);
  const startTime = parseTime(params.nextSeries.template_start_time as string);
  const endTime = parseTime(params.nextSeries.template_end_time as string);

  for (const [seriesIndex, dateStr] of occurrenceByIndex.entries()) {
    const startsAt = toUtcIso(dateStr, startTime.hours, startTime.minutes, params.nextSeries.timezone);
    const endsAt = toUtcIso(dateStr, endTime.hours, endTime.minutes, params.nextSeries.timezone);
    const existingEvent = existingByIndex.get(seriesIndex);

    if (existingEvent) {
      if (existingEvent.series_instance_modified || existingEvent.starts_at <= nowIso) continue;

      const { error: updateError } = await supabase
        .from('events')
        .update({
          starts_at: startsAt,
          ends_at: endsAt,
          timezone: params.nextSeries.timezone,
        })
        .eq('id', existingEvent.id);

      if (!updateError) updated++;
      continue;
    }

    if (startsAt <= nowIso) continue;

    const createdEvent = await createSeriesInstance({
      supabase,
      series: params.nextSeries,
      seriesId: params.seriesId,
      seriesIndex,
      dateStr,
      ticketTemplates,
    });

    if (createdEvent) created++;
  }

  const lastGeneratedDate = occurrenceDateStrings[occurrenceDateStrings.length - 1] ?? null;
  await supabase
    .from('event_series')
    .update({ last_generated_date: lastGeneratedDate })
    .eq('id', params.seriesId);

  return {
    updated,
    created,
    deleted: obsoleteEventIds.length,
  };
}

// ============================================================
// Update future unmodified instances
// ============================================================

/**
 * Update all future instances of a series that haven't been individually modified.
 */
export async function updateFutureInstances(
  seriesId: string,
  updates: Record<string, unknown>
): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('series_id', seriesId)
    .eq('series_instance_modified', false)
    .gt('starts_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('updateFutureInstances error:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}

// ============================================================
// Generate upcoming series instances (cron)
// ============================================================

/**
 * Generate instances for all active series approaching their horizon.
 * Called from the booking-reminders cron route.
 */
export async function generateUpcomingSeriesInstances(): Promise<void> {
  const supabase = createServiceClient();

  try {
    const { data: activeSeries } = await supabase
      .from('event_series')
      .select('id, generation_horizon_days, last_generated_date')
      .eq('status', 'active');

    if (!activeSeries) return;

    for (const series of activeSeries) {
      const now = new Date();
      const horizonDate = new Date(now);
      horizonDate.setDate(horizonDate.getDate() + (series.generation_horizon_days ?? 90));

      const lastGeneratedDate = series.last_generated_date ? new Date(series.last_generated_date) : null;
      if (!lastGeneratedDate || lastGeneratedDate < horizonDate) {
        const count = await generateSeriesInstances(series.id);
        if (count > 0) {
          console.log(`Generated ${count} instances for series ${series.id}`);
        }
      }
    }
  } catch (err) {
    console.error('generateUpcomingSeriesInstances error:', err);
  }
}
