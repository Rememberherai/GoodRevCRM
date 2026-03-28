import { z } from 'zod';
import { customQuestionSchema } from './calendar';

// ── Shared enums ────────────────────────────────────────────

export const accessModeSchema = z.enum(['tracked_only', 'reservable', 'loanable', 'hybrid']);
export const approvalPolicySchema = z.enum(['open_auto', 'open_review', 'approved_only']);
export const publicVisibilitySchema = z.enum(['listed', 'unlisted']);
export const reviewActionSchema = z.enum(['approve', 'deny', 'grant_access_and_approve']);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Hub settings (project-level) ────────────────────────────

export const upsertHubSettingsSchema = z.object({
  slug: z.string().min(1).max(100).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  accent_color: z.string().max(20).nullable().optional(),
  is_enabled: z.boolean().optional(),
});

export type UpsertHubSettingsInput = z.infer<typeof upsertHubSettingsSchema>;

// ── Asset access settings (per-asset) ───────────────────────

export const updateAssetAccessSettingsSchema = z.object({
  access_mode: accessModeSchema.optional(),
  access_enabled: z.boolean().optional(),
  resource_slug: z.string().min(1).max(100).regex(slugRegex, 'Slug must be lowercase alphanumeric with hyphens').nullable().optional(),
  public_name: z.string().min(1).max(200).nullable().optional(),
  public_description: z.string().max(5000).nullable().optional(),
  approval_policy: approvalPolicySchema.optional(),
  public_visibility: publicVisibilitySchema.optional(),
  access_instructions: z.string().max(5000).nullable().optional(),
  booking_owner_user_id: z.string().uuid().nullable().optional(),
  concurrent_capacity: z.number().int().min(1).optional(),
  return_required: z.boolean().optional(),
  custom_questions: z.array(customQuestionSchema).optional(),
});

export type UpdateAssetAccessSettingsInput = z.infer<typeof updateAssetAccessSettingsSchema>;

// ── Approver management ─────────────────────────────────────

export const addApproverSchema = z.object({
  user_id: z.string().uuid(),
});

export type AddApproverInput = z.infer<typeof addApproverSchema>;

// ── Person approval management ──────────────────────────────

export const grantPersonApprovalSchema = z.object({
  person_id: z.string().uuid(),
  notes: z.string().max(2000).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type GrantPersonApprovalInput = z.infer<typeof grantPersonApprovalSchema>;

export const updatePersonApprovalSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type UpdatePersonApprovalInput = z.infer<typeof updatePersonApprovalSchema>;

// ── Review actions ──────────────────────────────────────────

export const reviewRequestSchema = z.object({
  action: reviewActionSchema,
  notes: z.string().max(2000).optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;

// ── Return action ───────────────────────────────────────────

export const markReturnedSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export type MarkReturnedInput = z.infer<typeof markReturnedSchema>;

// ── Public: booking request ─────────────────────────────────

export const publicBookRequestSchema = z.object({
  event_type_id: z.string().uuid(),
  start_at: z.string().datetime(),
  guest_name: z.string().min(1).max(200).transform(s => s.trim()),
  guest_email: z.string().email().max(320).transform(s => s.toLowerCase().trim()),
  responses: z.record(z.string(), z.unknown()).optional(),
});

export type PublicBookRequestInput = z.infer<typeof publicBookRequestSchema>;

// ── Public: verification confirm ────────────────────────────
// No body needed — token is in the URL path

// ── Request list query params ───────────────────────────────

export const requestListQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  asset_id: z.string().uuid().optional(),
  approver_scope: z.enum(['mine', 'all']).optional(),
  cursor: z.string().optional(),
});

export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
