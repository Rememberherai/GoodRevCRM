import { z } from 'zod';

// Enum values
export const locationTypeValues = [
  'video', 'phone', 'in_person', 'custom', 'ask_invitee',
] as const;

export const schedulingTypeValues = [
  'one_on_one', 'group', 'round_robin', 'collective',
] as const;

export const bookingStatusValues = [
  'pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show',
] as const;

export const cancelledByValues = ['host', 'invitee', 'system'] as const;

export const questionTypeValues = [
  'text', 'textarea', 'select', 'radio', 'checkbox', 'phone', 'email',
] as const;

// Custom question schema
export const customQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(500),
  type: z.enum(questionTypeValues),
  required: z.boolean(),
  options: z.array(z.string().max(200)).optional(),
});

// ============================================================
// Calendar Profile
// ============================================================
export const createCalendarProfileSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  display_name: z.string().min(1).max(200),
  bio: z.string().max(2000).nullable().optional(),
  timezone: z.string().min(1).max(100).default('America/New_York'),
  avatar_url: z.string().url().max(2000).nullable().optional(),
  welcome_message: z.string().max(2000).nullable().optional(),
  booking_page_theme: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateCalendarProfileInput = z.infer<typeof createCalendarProfileSchema>;

export const updateCalendarProfileSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  display_name: z.string().min(1).max(200).optional(),
  bio: z.string().max(2000).nullable().optional(),
  timezone: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().max(2000).nullable().optional(),
  welcome_message: z.string().max(2000).nullable().optional(),
  booking_page_theme: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateCalendarProfileInput = z.infer<typeof updateCalendarProfileSchema>;

// ============================================================
// Availability Schedule
// ============================================================
export const availabilityRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
});

export const createAvailabilityScheduleSchema = z.object({
  name: z.string().min(1).max(200).default('Working Hours'),
  timezone: z.string().min(1).max(100).default('America/New_York'),
  is_default: z.boolean().optional().default(false),
  rules: z.array(availabilityRuleSchema).optional().default([]),
});

export type CreateAvailabilityScheduleInput = z.infer<typeof createAvailabilityScheduleSchema>;

export const updateAvailabilityScheduleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(100).optional(),
  is_default: z.boolean().optional(),
  rules: z.array(availabilityRuleSchema).optional(),
});

export type UpdateAvailabilityScheduleInput = z.infer<typeof updateAvailabilityScheduleSchema>;

// ============================================================
// Availability Override
// ============================================================
export const createAvailabilityOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  is_available: z.boolean(),
  reason: z.string().max(500).nullable().optional(),
}).refine(
  (data) => {
    if (data.is_available) {
      return data.start_time != null && data.end_time != null;
    }
    return true;
  },
  { message: 'start_time and end_time are required when is_available is true' }
).refine(
  (data) => {
    if (data.is_available && data.start_time && data.end_time) {
      return data.start_time < data.end_time;
    }
    return true;
  },
  { message: 'start_time must be before end_time' }
);

export type CreateAvailabilityOverrideInput = z.infer<typeof createAvailabilityOverrideSchema>;

// ============================================================
// Event Type
// ============================================================
export const createEventTypeSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(5000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  color: z.string().max(50).optional().default('#3b82f6'),
  location_type: z.enum(locationTypeValues).default('video'),
  location_value: z.string().max(2000).nullable().optional(),
  buffer_before_minutes: z.number().int().min(0).max(120).default(0),
  buffer_after_minutes: z.number().int().min(0).max(120).default(0),
  min_notice_hours: z.number().int().min(0).max(720).default(24),
  max_days_in_advance: z.number().int().min(1).max(365).default(60),
  slot_interval_minutes: z.number().int().min(5).max(480).nullable().optional(),
  daily_limit: z.number().int().min(1).max(100).nullable().optional(),
  weekly_limit: z.number().int().min(1).max(500).nullable().optional(),
  schedule_id: z.string().uuid().nullable().optional(),
  requires_confirmation: z.boolean().optional().default(false),
  custom_questions: z.array(customQuestionSchema).optional().default([]),
  confirmation_message: z.string().max(5000).nullable().optional(),
  cancellation_policy: z.string().max(5000).nullable().optional(),
  default_meeting_type: z.string().max(100).optional().default('general'),
  redirect_url: z.string().url().max(2000).nullable().optional(),
});

export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>;

export const updateEventTypeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(5000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  color: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
  location_type: z.enum(locationTypeValues).optional(),
  location_value: z.string().max(2000).nullable().optional(),
  buffer_before_minutes: z.number().int().min(0).max(120).optional(),
  buffer_after_minutes: z.number().int().min(0).max(120).optional(),
  min_notice_hours: z.number().int().min(0).max(720).optional(),
  max_days_in_advance: z.number().int().min(1).max(365).optional(),
  slot_interval_minutes: z.number().int().min(5).max(480).nullable().optional(),
  daily_limit: z.number().int().min(1).max(100).nullable().optional(),
  weekly_limit: z.number().int().min(1).max(500).nullable().optional(),
  schedule_id: z.string().uuid().nullable().optional(),
  requires_confirmation: z.boolean().optional(),
  custom_questions: z.array(customQuestionSchema).optional(),
  confirmation_message: z.string().max(5000).nullable().optional(),
  cancellation_policy: z.string().max(5000).nullable().optional(),
  default_meeting_type: z.string().max(100).optional(),
  redirect_url: z.string().url().max(2000).nullable().optional(),
});

export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>;

// ============================================================
// Booking (public booking creation)
// ============================================================
export const createPublicBookingSchema = z.object({
  event_type_id: z.string().uuid(),
  start_at: z.string().datetime(),
  invitee_name: z.string().min(1).max(200),
  invitee_email: z.string().email().max(320),
  invitee_phone: z.string().max(30).nullable().optional(),
  invitee_timezone: z.string().max(100).optional(),
  invitee_notes: z.string().max(2000).nullable().optional(),
  responses: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreatePublicBookingInput = z.infer<typeof createPublicBookingSchema>;

// Booking status update (host)
export const updateBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']),
  cancellation_reason: z.string().max(2000).nullable().optional(),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

// Cancel via token (public)
export const cancelBookingByTokenSchema = z.object({
  token: z.string().min(1),
  reason: z.string().max(2000).nullable().optional(),
});

export type CancelBookingByTokenInput = z.infer<typeof cancelBookingByTokenSchema>;

// Reschedule via token (public)
export const rescheduleBookingByTokenSchema = z.object({
  token: z.string().min(1),
  new_start_at: z.string().datetime(),
});

export type RescheduleBookingByTokenInput = z.infer<typeof rescheduleBookingByTokenSchema>;

// Slot query params
export const slotQuerySchema = z.object({
  event_type_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().max(100).optional(),
});

export type SlotQueryInput = z.infer<typeof slotQuerySchema>;
