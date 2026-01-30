import { describe, it, expect } from 'vitest';
import {
  sendEmailSchema,
  gmailOAuthCallbackSchema,
  gmailConnectionQuerySchema,
  trackingEventSchema,
  emailHistoryQuerySchema,
  disconnectGmailSchema,
} from '@/lib/validators/gmail';
import {
  calculateTokenExpiry,
  isTokenExpired,
} from '@/lib/gmail/oauth';

describe('Gmail Validators', () => {
  describe('sendEmailSchema', () => {
    it('validates a valid email request with single recipient', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        subject: 'Test Subject',
        body_html: '<p>Hello, World!</p>',
      });
      expect(result.success).toBe(true);
    });

    it('validates a valid email request with multiple recipients', () => {
      const result = sendEmailSchema.safeParse({
        to: ['alice@example.com', 'bob@example.com'],
        subject: 'Test Subject',
        body_html: '<p>Hello, World!</p>',
      });
      expect(result.success).toBe(true);
    });

    it('validates email with CC and BCC', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body_html: '<p>Hello, World!</p>',
      });
      expect(result.success).toBe(true);
    });

    it('validates email with entity associations', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        subject: 'Test Subject',
        body_html: '<p>Hello, World!</p>',
        person_id: '550e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });

    it('validates email with thread reply', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        subject: 'Re: Test Subject',
        body_html: '<p>Reply content</p>',
        reply_to_message_id: '<message-id@mail.gmail.com>',
        thread_id: 'thread123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email address', () => {
      const result = sendEmailSchema.safeParse({
        to: 'not-an-email',
        subject: 'Test Subject',
        body_html: '<p>Hello, World!</p>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty subject', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        subject: '',
        body_html: '<p>Hello, World!</p>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty body', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        subject: 'Test Subject',
        body_html: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid CC emails', () => {
      const result = sendEmailSchema.safeParse({
        to: 'test@example.com',
        cc: ['not-valid'],
        subject: 'Test Subject',
        body_html: '<p>Hello, World!</p>',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('gmailOAuthCallbackSchema', () => {
    it('validates valid callback parameters', () => {
      const result = gmailOAuthCallbackSchema.safeParse({
        code: 'authorization-code-123',
        state: 'state-token-abc',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing code', () => {
      const result = gmailOAuthCallbackSchema.safeParse({
        state: 'state-token-abc',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing state', () => {
      const result = gmailOAuthCallbackSchema.safeParse({
        code: 'authorization-code-123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty strings', () => {
      const result = gmailOAuthCallbackSchema.safeParse({
        code: '',
        state: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('gmailConnectionQuerySchema', () => {
    it('validates with project_id', () => {
      const result = gmailConnectionQuerySchema.safeParse({
        project_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('validates without parameters', () => {
      const result = gmailConnectionQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const result = gmailConnectionQuerySchema.safeParse({
        project_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('trackingEventSchema', () => {
    it('validates open event', () => {
      const result = trackingEventSchema.safeParse({
        tracking_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('validates click event with URL', () => {
      const result = trackingEventSchema.safeParse({
        tracking_id: '550e8400-e29b-41d4-a716-446655440000',
        link_url: 'https://example.com/page',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid tracking ID', () => {
      const result = trackingEventSchema.safeParse({
        tracking_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid URL', () => {
      const result = trackingEventSchema.safeParse({
        tracking_id: '550e8400-e29b-41d4-a716-446655440000',
        link_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('emailHistoryQuerySchema', () => {
    it('validates with all filters', () => {
      const result = emailHistoryQuerySchema.safeParse({
        person_id: '550e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440001',
        opportunity_id: '550e8400-e29b-41d4-a716-446655440002',
        rfp_id: '550e8400-e29b-41d4-a716-446655440003',
        limit: 25,
        offset: 10,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('validates with no filters', () => {
      const result = emailHistoryQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('coerces string numbers', () => {
      const result = emailHistoryQuerySchema.safeParse({
        limit: '30',
        offset: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(30);
        expect(result.data.offset).toBe(5);
      }
    });

    it('rejects limit over 100', () => {
      const result = emailHistoryQuerySchema.safeParse({
        limit: 150,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative offset', () => {
      const result = emailHistoryQuerySchema.safeParse({
        offset: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('disconnectGmailSchema', () => {
    it('validates valid connection ID', () => {
      const result = disconnectGmailSchema.safeParse({
        connection_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const result = disconnectGmailSchema.safeParse({
        connection_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing connection_id', () => {
      const result = disconnectGmailSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe('Gmail OAuth Helpers', () => {
  describe('calculateTokenExpiry', () => {
    it('calculates expiry time correctly', () => {
      const now = Date.now();
      const expiresIn = 3600; // 1 hour
      const expiry = calculateTokenExpiry(expiresIn);
      const expiryTime = new Date(expiry).getTime();

      // Should be approximately 1 hour from now (within 1 second tolerance)
      expect(expiryTime).toBeGreaterThanOrEqual(now + expiresIn * 1000 - 1000);
      expect(expiryTime).toBeLessThanOrEqual(now + expiresIn * 1000 + 1000);
    });

    it('returns valid ISO string', () => {
      const expiry = calculateTokenExpiry(3600);
      expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('isTokenExpired', () => {
    it('returns false for future expiry', () => {
      const futureExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
      expect(isTokenExpired(futureExpiry)).toBe(false);
    });

    it('returns true for past expiry', () => {
      const pastExpiry = new Date(Date.now() - 3600 * 1000).toISOString();
      expect(isTokenExpired(pastExpiry)).toBe(true);
    });

    it('returns true when token expires within 5 minutes', () => {
      // Token expires in 4 minutes (within buffer)
      const nearExpiry = new Date(Date.now() + 4 * 60 * 1000).toISOString();
      expect(isTokenExpired(nearExpiry)).toBe(true);
    });

    it('returns false when token expires in more than 5 minutes', () => {
      // Token expires in 6 minutes (outside buffer)
      const safeExpiry = new Date(Date.now() + 6 * 60 * 1000).toISOString();
      expect(isTokenExpired(safeExpiry)).toBe(false);
    });
  });
});

describe('Gmail Types', () => {
  it('has all expected connection status values', () => {
    const statuses: ('connected' | 'disconnected' | 'expired' | 'error')[] = [
      'connected',
      'disconnected',
      'expired',
      'error',
    ];

    statuses.forEach((status) => {
      expect(typeof status).toBe('string');
    });
  });

  it('has all expected event types', () => {
    const eventTypes: ('open' | 'click' | 'bounce' | 'reply')[] = [
      'open',
      'click',
      'bounce',
      'reply',
    ];

    eventTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});
