import { z } from 'zod';
import { uuidSchema, nullableString } from './community/shared';
import { customQuestionSchema } from './calendar';

// ── Enum schemas ────────────────────────────────────────────

export const eventStatusSchema = z.enum(['draft', 'published', 'cancelled', 'postponed', 'completed']);
export const eventVisibilitySchema = z.enum(['public', 'unlisted', 'private']);
export const eventLocationTypeSchema = z.enum(['in_person', 'virtual', 'hybrid']);
export const eventRegistrationStatusSchema = z.enum([
  'pending_approval', 'pending_waiver', 'confirmed', 'waitlisted', 'cancelled',
]);
export const recurrenceFrequencySchema = z.enum(['daily', 'weekly', 'biweekly', 'monthly']);
export const recurrenceDaySchema = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

// ── Event base fields ───────────────────────────────────────

const eventBaseFields = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).max(100).optional(),
  description: z.string().max(5000).nullable().optional(),
  description_html: z.string().max(20000).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  timezone: z.string().max(50).optional(),
  is_all_day: z.boolean().optional(),
  location_type: eventLocationTypeSchema.optional(),
  venue_name: nullableString(200, 'Venue name too long'),
  venue_address: nullableString(500, 'Address too long'),
  venue_latitude: z.number().min(-90).max(90).nullable().optional(),
  venue_longitude: z.number().min(-180).max(180).nullable().optional(),
  virtual_url: z.string().url().nullable().optional(),
  registration_enabled: z.boolean().optional(),
  registration_opens_at: z.string().datetime().nullable().optional(),
  registration_closes_at: z.string().datetime().nullable().optional(),
  total_capacity: z.number().int().min(1).nullable().optional(),
  waitlist_enabled: z.boolean().optional(),
  max_tickets_per_registration: z.number().int().min(1).max(100).optional(),
  require_approval: z.boolean().optional(),
  add_to_crm: z.boolean().optional(),
  custom_questions: z.array(customQuestionSchema).max(20).optional(),
  visibility: eventVisibilitySchema.optional(),
  program_id: uuidSchema.nullable().optional(),
  organizer_name: nullableString(200, 'Name too long'),
  organizer_email: z.string().email().nullable().optional(),
  confirmation_message: z.string().max(2000).nullable().optional(),
  cancellation_policy: z.string().max(2000).nullable().optional(),
  requires_waiver: z.boolean().optional(),
});

export const createEventSchema = eventBaseFields.refine(
  (data) => new Date(data.ends_at) > new Date(data.starts_at),
  { message: 'End time must be after start time', path: ['ends_at'] }
);

export const updateEventSchema = eventBaseFields.partial().superRefine((data, ctx) => {
  if (data.starts_at && data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
    ctx.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['ends_at'] });
  }
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ── Ticket types ────────────────────────────────────────────

export const createTicketTypeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  price_cents: z.literal(0).optional(),
  quantity_available: z.number().int().min(1).nullable().optional(),
  max_per_order: z.number().int().min(1).max(100).optional(),
  sort_order: z.number().int().optional(),
  sales_start_at: z.string().datetime().nullable().optional(),
  sales_end_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional(),
  is_hidden: z.boolean().optional(),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();

export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;

// ── Public registration ─────────────────────────────────────

export const publicEventRegistrationSchema = z.object({
  event_id: uuidSchema,
  registrant_name: z.string().min(1).max(200),
  registrant_email: z.string().email().max(320),
  registrant_phone: z.string().max(30).nullable().optional(),
  ticket_selections: z.array(z.object({
    ticket_type_id: uuidSchema,
    quantity: z.number().int().min(1).max(100),
    attendee_name: z.string().max(200).nullable().optional(),
    attendee_email: z.string().email().nullable().optional(),
  })).min(1).max(20),
  responses: z.record(z.string(), z.unknown()).optional(),
});

export type PublicEventRegistrationInput = z.infer<typeof publicEventRegistrationSchema>;

// ── Check-in ────────────────────────────────────────────────

export const checkInSchema = z.object({
  qr_code: z.string().min(1).optional(),
  registration_id: uuidSchema.optional(),
  ticket_id: uuidSchema.optional(),
}).refine(
  (data) => data.qr_code || data.registration_id || data.ticket_id,
  { message: 'Must provide qr_code, registration_id, or ticket_id' }
);

export type CheckInInput = z.infer<typeof checkInSchema>;

// ── Event series ────────────────────────────────────────────

const eventSeriesBaseFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  description_html: z.string().max(20000).nullable().optional(),
  program_id: uuidSchema.nullable().optional(),
  recurrence_frequency: recurrenceFrequencySchema,
  recurrence_days_of_week: z.array(recurrenceDaySchema).min(1).optional(),
  recurrence_interval: z.number().int().min(1).max(12).optional(),
  recurrence_until: z.string().date().nullable().optional(),
  recurrence_count: z.number().int().min(1).max(365).nullable().optional(),
  recurrence_day_position: z.number().int().min(1).max(5).nullable().optional(),
  template_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  template_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().max(50).optional(),
  location_type: eventLocationTypeSchema.optional(),
  venue_name: nullableString(200, 'Venue name too long'),
  venue_address: nullableString(500, 'Address too long'),
  venue_latitude: z.number().min(-90).max(90).nullable().optional(),
  venue_longitude: z.number().min(-180).max(180).nullable().optional(),
  virtual_url: z.string().url().nullable().optional(),
  registration_enabled: z.boolean().optional(),
  total_capacity: z.number().int().min(1).nullable().optional(),
  waitlist_enabled: z.boolean().optional(),
  max_tickets_per_registration: z.number().int().min(1).max(100).optional(),
  require_approval: z.boolean().optional(),
  custom_questions: z.array(customQuestionSchema).max(20).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  visibility: eventVisibilitySchema.optional(),
  confirmation_message: z.string().max(2000).nullable().optional(),
  cancellation_policy: z.string().max(2000).nullable().optional(),
  organizer_name: nullableString(200, 'Name too long'),
  organizer_email: z.string().email().nullable().optional(),
  generation_horizon_days: z.number().int().min(7).max(365).optional(),
  ticket_types: z.array(createTicketTypeSchema).min(1).max(10).optional(),
});

export const createEventSeriesSchema = eventSeriesBaseFields
  .refine(
    (data) => !(data.recurrence_until && data.recurrence_count),
    { message: 'Specify either recurrence_until or recurrence_count, not both' }
  )
  .refine(
    (data) => data.template_end_time > data.template_start_time,
    { message: 'End time must be after start time', path: ['template_end_time'] }
  )
  .refine(
    (data) => {
      if (data.recurrence_frequency === 'weekly' || data.recurrence_frequency === 'biweekly') {
        return data.recurrence_days_of_week && data.recurrence_days_of_week.length > 0;
      }
      return true;
    },
    { message: 'Days of week are required for weekly/biweekly recurrence', path: ['recurrence_days_of_week'] }
  );

export const updateEventSeriesSchema = eventSeriesBaseFields.partial();

export type CreateEventSeriesInput = z.infer<typeof createEventSeriesSchema>;
export type UpdateEventSeriesInput = z.infer<typeof updateEventSeriesSchema>;

// ── Public series registration ──────────────────────────────

export const publicSeriesRegistrationSchema = z.object({
  series_id: uuidSchema,
  registrant_name: z.string().min(1).max(200),
  registrant_email: z.string().email().max(320),
  registrant_phone: z.string().max(30).nullable().optional(),
  ticket_selections: z.array(z.object({
    ticket_type_id: uuidSchema,
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(20),
  responses: z.record(z.string(), z.unknown()).optional(),
});

export type PublicSeriesRegistrationInput = z.infer<typeof publicSeriesRegistrationSchema>;

// ── Calendar settings ───────────────────────────────────────

export const eventCalendarSettingsSchema = z.object({
  is_enabled: z.boolean().optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/).min(2).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().max(50).optional(),
});

export type EventCalendarSettingsInput = z.infer<typeof eventCalendarSettingsSchema>;

// ── Batch attendance ────────────────────────────────────────

export const batchAttendanceSchema = z.object({
  attendees: z.array(z.object({
    registration_id: uuidSchema,
    status: z.enum(['present', 'absent', 'excused']),
  })).min(1),
});

export type BatchAttendanceInput = z.infer<typeof batchAttendanceSchema>;

// ── Scan attendance confirmation ────────────────────────────

export const scanAttendanceConfirmSchema = z.object({
  confirmations: z.array(z.object({
    raw_text: z.string(),
    person_id: uuidSchema.optional(),
    create_new: z.boolean(),
  })).min(1),
});

export type ScanAttendanceConfirmInput = z.infer<typeof scanAttendanceConfirmSchema>;
