import { z } from 'zod';

// Call dispositions
export const callDispositionValues = [
  'no_answer', 'left_voicemail', 'busy', 'wrong_number',
  'quality_conversation', 'meeting_booked', 'not_interested',
  'call_back_later', 'do_not_call', 'other',
] as const;

// Call statuses
export const callStatusValues = [
  'initiated', 'ringing', 'answered', 'hangup',
  'failed', 'busy', 'no_answer', 'machine_detected',
] as const;

// Call directions
export const callDirectionValues = ['inbound', 'outbound'] as const;

// Query schema for listing calls
export const callQuerySchema = z.object({
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  direction: z.enum(callDirectionValues).optional(),
  status: z.enum(callStatusValues).optional(),
  disposition: z.enum(callDispositionValues).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type CallQuery = z.infer<typeof callQuerySchema>;

// Schema for initiating an outbound call
export const initiateCallSchema = z.object({
  to_number: z.string().min(1, 'Phone number is required').max(50),
  person_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  opportunity_id: z.string().uuid().optional().nullable(),
  rfp_id: z.string().uuid().optional().nullable(),
  record: z.boolean().optional(),
});

export type InitiateCallInput = z.infer<typeof initiateCallSchema>;

// Schema for updating call disposition
export const updateCallDispositionSchema = z.object({
  disposition: z.enum(callDispositionValues),
  disposition_notes: z.string().max(5000).optional().nullable(),
  follow_up_date: z.string().datetime().optional().nullable(),
  follow_up_title: z.string().max(500).optional().nullable(),
});

export type UpdateCallDispositionInput = z.infer<typeof updateCallDispositionSchema>;

// Schema for Telnyx connection setup
export const telnyxConnectionSchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  call_control_app_id: z.string().optional().nullable(),
  sip_connection_id: z.string().optional().nullable(),
  sip_username: z.string().optional().nullable(),
  sip_password: z.string().optional().nullable(),
  phone_number: z.string().min(1, 'Phone number is required').max(20),
  phone_number_id: z.string().optional().nullable(),
  record_calls: z.boolean(),
  amd_enabled: z.boolean(),
  caller_id_name: z.string().max(50).optional().nullable(),
});

export type TelnyxConnectionInput = z.infer<typeof telnyxConnectionSchema>;

// Schema for call metrics query
export const callMetricsQuerySchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  user_id: z.string().uuid().optional(),
});

export type CallMetricsQuery = z.infer<typeof callMetricsQuerySchema>;
