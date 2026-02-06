import { z } from 'zod';

/**
 * Schema for sending an SMS message
 */
export const sendSmsSchema = z.object({
  to_number: z
    .string()
    .min(1, 'Phone number is required')
    .max(20, 'Phone number is too long')
    .refine(
      (val) => {
        // Must contain only digits, plus sign, hyphens, parentheses, spaces
        const cleaned = val.replace(/[\s\-()]/g, '');
        return /^\+?[\d]{7,15}$/.test(cleaned);
      },
      { message: 'Invalid phone number format' }
    ),
  body: z
    .string()
    .min(1, 'Message body is required')
    .max(1600, 'Message body exceeds maximum length of 1600 characters'),
  person_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),
  opportunity_id: z.string().uuid().optional().nullable(),
  rfp_id: z.string().uuid().optional().nullable(),
});

export type SendSmsInput = z.infer<typeof sendSmsSchema>;

/**
 * Schema for querying SMS messages
 */
export const listSmsSchema = z.object({
  person_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

export type ListSmsInput = z.infer<typeof listSmsSchema>;

/**
 * SMS message status values
 */
export const SMS_STATUS = {
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RECEIVED: 'received',
} as const;

export type SmsStatus = (typeof SMS_STATUS)[keyof typeof SMS_STATUS];

/**
 * SMS direction values
 */
export const SMS_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export type SmsDirection = (typeof SMS_DIRECTION)[keyof typeof SMS_DIRECTION];
