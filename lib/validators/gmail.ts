import { z } from 'zod';

// Schema for sending an email
export const sendEmailSchema = z.object({
  to: z.union([
    z.string().email('Invalid email address'),
    z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient required'),
  ]),
  cc: z.array(z.string().email('Invalid CC email')).optional(),
  bcc: z.array(z.string().email('Invalid BCC email')).optional(),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  body_html: z.string().min(1, 'Email body is required'),
  body_text: z.string().optional(),
  reply_to_message_id: z.string().optional(),
  thread_id: z.string().optional(),
  // Entity associations
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  rfp_id: z.string().uuid().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// Schema for Gmail OAuth callback
export const gmailOAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

export type GmailOAuthCallbackInput = z.infer<typeof gmailOAuthCallbackSchema>;

// Schema for Gmail connection query
export const gmailConnectionQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
});

export type GmailConnectionQuery = z.infer<typeof gmailConnectionQuerySchema>;

// Schema for tracking pixel/link
export const trackingEventSchema = z.object({
  tracking_id: z.string().uuid('Invalid tracking ID'),
  link_url: z.string().url().optional(),
});

export type TrackingEventInput = z.infer<typeof trackingEventSchema>;

// Schema for email history query
export const emailHistoryQuerySchema = z.object({
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  opportunity_id: z.string().uuid().optional(),
  rfp_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type EmailHistoryQuery = z.infer<typeof emailHistoryQuerySchema>;

// Schema for disconnect Gmail
export const disconnectGmailSchema = z.object({
  connection_id: z.string().uuid('Invalid connection ID'),
});

export type DisconnectGmailInput = z.infer<typeof disconnectGmailSchema>;
