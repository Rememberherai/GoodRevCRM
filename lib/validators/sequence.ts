import { z } from 'zod';

// Sequence settings schema
const sequenceSettingsSchema = z.object({
  send_as_reply: z.boolean().default(true),
  stop_on_reply: z.boolean().default(true),
  stop_on_bounce: z.boolean().default(true),
  track_opens: z.boolean().default(true),
  track_clicks: z.boolean().default(true),
  send_window_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  send_window_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  send_days: z.array(z.number().min(0).max(6)).optional(),
  timezone: z.string().optional(),
});

// Create sequence schema
export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  settings: sequenceSettingsSchema.optional(),
  organization_id: z.string().uuid('Invalid organization ID').nullable().optional(),
  person_id: z.string().uuid('Invalid person ID').nullable().optional(),
});

export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

// Update sequence schema
export const updateSequenceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  settings: sequenceSettingsSchema.optional(),
});

export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;

// Step condition schema
const stepConditionSchema = z.object({
  type: z.enum(['opened', 'clicked', 'not_opened', 'not_clicked']),
  step_id: z.string().uuid().optional(),
});

// Create step schema
export const createStepSchema = z.object({
  step_type: z.enum(['email', 'delay', 'condition']),
  step_number: z.number().int().min(1).optional(),
  subject: z.string().max(998).nullable().optional(),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  delay_amount: z.number().int().min(1).nullable().optional(),
  delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks']).nullable().optional(),
  condition: stepConditionSchema.nullable().optional(),
});

export type CreateStepInput = z.infer<typeof createStepSchema>;

// Update step schema
export const updateStepSchema = z.object({
  step_number: z.number().int().min(1).optional(),
  subject: z.string().max(998).nullable().optional(),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  delay_amount: z.number().int().min(1).nullable().optional(),
  delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks']).nullable().optional(),
  condition: stepConditionSchema.nullable().optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;

// Enroll person schema
export const enrollPersonSchema = z.object({
  person_id: z.string().uuid('Invalid person ID'),
  gmail_connection_id: z.string().uuid('Invalid Gmail connection ID'),
  start_at: z.string().datetime().optional(),
});

export type EnrollPersonInput = z.infer<typeof enrollPersonSchema>;

// Bulk enroll schema
export const bulkEnrollSchema = z.object({
  person_ids: z.array(z.string().uuid()).min(1).max(100),
  gmail_connection_id: z.string().uuid('Invalid Gmail connection ID'),
  start_at: z.string().datetime().optional(),
});

export type BulkEnrollInput = z.infer<typeof bulkEnrollSchema>;

// Update enrollment schema
export const updateEnrollmentSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed']).optional(),
  current_step: z.number().int().min(1).optional(),
  next_send_at: z.string().datetime().nullable().optional(),
});

export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;

// Signature schemas
export const createSignatureSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  content_html: z.string().min(1, 'Content is required'),
  is_default: z.boolean().default(false),
});

export type CreateSignatureInput = z.infer<typeof createSignatureSchema>;

export const updateSignatureSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content_html: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export type UpdateSignatureInput = z.infer<typeof updateSignatureSchema>;

// Query schemas
export const sequenceQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  organization_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  scope: z.enum(['all', 'project', 'organization', 'person']).optional(), // all = all sequences, project = project-wide only, organization = org-specific only, person = person-specific only
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type SequenceQuery = z.infer<typeof sequenceQuerySchema>;

export const enrollmentQuerySchema = z.object({
  sequence_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type EnrollmentQuery = z.infer<typeof enrollmentQuerySchema>;

// ============================================
// AI Sequence Generation Schemas
// ============================================

// Sequence types for AI generation
export const sequenceTypeSchema = z.enum([
  'cold_outreach',
  'follow_up',
  're_engagement',
  'event_invitation',
  'nurture',
  'onboarding',
]);

export type SequenceType = z.infer<typeof sequenceTypeSchema>;

// Tone options for generated emails
export const toneSchema = z.enum(['formal', 'professional', 'casual']);

export type Tone = z.infer<typeof toneSchema>;

// Company context for AI generation
const companyContextSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  description: z.string().min(10, 'Please provide a brief company description').max(2000),
  products: z.array(z.string()).optional(),
  valuePropositions: z.array(z.string()).optional(),
});

// Target audience for AI generation
const targetAudienceSchema = z.object({
  description: z.string().min(10, 'Please describe your target audience').max(1000),
  painPoints: z.array(z.string()).optional(),
  jobTitles: z.array(z.string()).optional(),
});

// Campaign goals for AI generation
const campaignGoalsSchema = z.object({
  primaryCta: z.string().min(1, 'Primary CTA is required').max(200),
  secondaryCtas: z.array(z.string()).optional(),
  keyMessages: z.array(z.string()).optional(),
});

// Delay preferences for sequence timing
const delayPreferencesSchema = z.object({
  minDays: z.number().min(1).max(14).default(1),
  maxDays: z.number().min(1).max(30).default(7),
});

// Main AI sequence generation input schema
export const generateSequenceInputSchema = z.object({
  sequenceType: sequenceTypeSchema,
  tone: toneSchema,
  numberOfSteps: z.number().min(2).max(10),
  companyContext: companyContextSchema,
  targetAudience: targetAudienceSchema,
  campaignGoals: campaignGoalsSchema,
  delayPreferences: delayPreferencesSchema.optional(),
  preview: z.boolean().optional().default(true),
  organizationId: z.string().uuid().nullable().optional(), // Optional org-specific sequence
  personId: z.string().uuid().nullable().optional(), // Optional person-specific sequence
});

export type GenerateSequenceInput = z.infer<typeof generateSequenceInputSchema>;

// Generated step schema (for AI response validation)
const generatedStepSchema = z.object({
  step_number: z.number().int().min(1),
  step_type: z.enum(['email', 'delay']),
  subject: z.string().nullable().optional(),
  body_html: z.string().nullable().optional(),
  body_text: z.string().nullable().optional(),
  delay_amount: z.number().int().min(1).nullable().optional(),
  delay_unit: z.enum(['hours', 'days', 'weeks']).nullable().optional(),
});

// Generated sequence schema (for AI response validation)
export const generatedSequenceSchema = z.object({
  sequence: z.object({
    name: z.string(),
    description: z.string(),
  }),
  steps: z.array(generatedStepSchema).min(2),
});

export type GeneratedSequence = z.infer<typeof generatedSequenceSchema>;

// Regenerate single step input
export const regenerateStepInputSchema = z.object({
  instructions: z.string().max(500).optional(),
  keepSubject: z.boolean().optional().default(false),
  keepTone: z.boolean().optional().default(true),
});

export type RegenerateStepInput = z.infer<typeof regenerateStepInputSchema>;

// Sequence type labels for UI
export const SEQUENCE_TYPE_LABELS: Record<SequenceType, string> = {
  cold_outreach: 'Cold Outreach',
  follow_up: 'Follow-up',
  re_engagement: 'Re-engagement',
  event_invitation: 'Event Invitation',
  nurture: 'Nurture Campaign',
  onboarding: 'Onboarding',
};

// Sequence type descriptions for UI
export const SEQUENCE_TYPE_DESCRIPTIONS: Record<SequenceType, string> = {
  cold_outreach: 'Initial outreach to prospects who haven\'t heard from you before',
  follow_up: 'Follow up after an initial contact or meeting',
  re_engagement: 'Re-engage with contacts who have gone cold',
  event_invitation: 'Invite contacts to webinars, demos, or events',
  nurture: 'Long-term nurture campaign to build relationships',
  onboarding: 'Welcome and onboard new customers or users',
};

// Tone labels for UI
export const TONE_LABELS: Record<Tone, string> = {
  formal: 'Formal',
  professional: 'Professional',
  casual: 'Casual',
};

// Tone descriptions for UI
export const TONE_DESCRIPTIONS: Record<Tone, string> = {
  formal: 'Traditional business language, appropriate for executives and enterprise',
  professional: 'Friendly but business-appropriate, good for most B2B contexts',
  casual: 'Conversational and relaxed, good for startups and SMBs',
};
