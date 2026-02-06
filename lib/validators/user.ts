import { z } from 'zod';

// Project roles
export const projectRoles = ['owner', 'admin', 'member', 'viewer'] as const;

// Notification digest options
export const notificationDigests = ['realtime', 'daily', 'weekly', 'never'] as const;

// Invite member schema
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Update member role schema
export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// User settings schema
export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  timezone: z.string().min(1).max(100).optional(),
  date_format: z.string().min(1).max(20).optional(),
  time_format: z.string().min(1).max(20).optional(),
  notifications_email: z.boolean().optional(),
  notifications_push: z.boolean().optional(),
  notifications_digest: z.enum(notificationDigests).optional(),
  default_project_id: z.string().uuid().nullable().optional(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

// Update profile schema
export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().startsWith('https://', { message: 'Avatar URL must use HTTPS' }).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Member query schema
export const memberQuerySchema = z.object({
  role: z.enum(projectRoles).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type MemberQueryInput = z.infer<typeof memberQuerySchema>;

// Invitation query schema
export const invitationQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'expired']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type InvitationQueryInput = z.infer<typeof invitationQuerySchema>;

// Accept invitation schema
export const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid invitation token'),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
