import { z } from 'zod';

export const meetingTypeValues = [
  'discovery', 'demo', 'proposal_review', 'negotiation',
  'onboarding', 'check_in', 'qbr', 'general',
] as const;

export const meetingStatusValues = [
  'scheduled', 'confirmed', 'attended', 'no_show', 'rescheduled', 'cancelled',
] as const;

export const meetingOutcomeValues = [
  'positive', 'neutral', 'negative', 'follow_up_needed', 'deal_advanced', 'no_outcome',
] as const;

export const attendanceStatusValues = [
  'pending', 'accepted', 'declined', 'tentative', 'attended', 'no_show',
] as const;

// Create meeting schema
export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).nullable().optional(),
  meeting_type: z.enum(meetingTypeValues).default('general'),
  scheduled_at: z.string().datetime('Scheduled date/time is required'),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  location: z.string().max(500).nullable().optional(),
  meeting_url: z.string().url().max(2000).nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  rfp_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  attendee_person_ids: z.array(z.string().uuid()).optional().default([]),
  attendee_user_ids: z.array(z.string().uuid()).optional().default([]),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

// Update meeting schema
export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  meeting_type: z.enum(meetingTypeValues).optional(),
  scheduled_at: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  location: z.string().max(500).nullable().optional(),
  meeting_url: z.string().url().max(2000).nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  opportunity_id: z.string().uuid().nullable().optional(),
  rfp_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  attendee_person_ids: z.array(z.string().uuid()).optional(),
  attendee_user_ids: z.array(z.string().uuid()).optional(),
});

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

// Meeting status update schema
export const updateMeetingStatusSchema = z.object({
  status: z.enum(meetingStatusValues),
  // For attended status
  outcome: z.enum(meetingOutcomeValues).nullable().optional(),
  outcome_notes: z.string().max(5000).nullable().optional(),
  next_steps: z.string().max(5000).nullable().optional(),
  // For rescheduled status
  new_scheduled_at: z.string().datetime().nullable().optional(),
  // For cancelled status
  cancellation_reason: z.string().max(2000).nullable().optional(),
});

export type UpdateMeetingStatusInput = z.infer<typeof updateMeetingStatusSchema>;

// Meeting query schema
export const meetingQuerySchema = z.object({
  status: z.enum(meetingStatusValues).optional(),
  meeting_type: z.enum(meetingTypeValues).optional(),
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  rfp_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  scheduled_after: z.string().datetime().optional(),
  scheduled_before: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type MeetingQuery = z.infer<typeof meetingQuerySchema>;
