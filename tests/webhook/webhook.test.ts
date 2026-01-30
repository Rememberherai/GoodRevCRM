import { describe, it, expect } from 'vitest';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookQuerySchema,
  webhookDeliveryQuerySchema,
  testWebhookSchema,
} from '@/lib/validators/webhook';

describe('Webhook Validators', () => {
  describe('createWebhookSchema', () => {
    it('should validate a valid webhook', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created', 'person.updated'],
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const input = {
        url: 'https://example.com/webhook',
        events: ['person.created'],
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require valid URL', () => {
      const input = {
        name: 'My Webhook',
        url: 'not-a-url',
        events: ['person.created'],
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require at least one event', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: [],
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid event types', () => {
      const events = [
        'person.created',
        'person.updated',
        'person.deleted',
        'organization.created',
        'organization.updated',
        'organization.deleted',
        'opportunity.created',
        'opportunity.updated',
        'opportunity.deleted',
        'opportunity.stage_changed',
        'opportunity.won',
        'opportunity.lost',
        'task.created',
        'task.updated',
        'task.deleted',
        'task.completed',
        'rfp.created',
        'rfp.updated',
        'rfp.deleted',
        'rfp.status_changed',
        'email.sent',
        'email.opened',
        'email.clicked',
        'email.replied',
      ];

      for (const event of events) {
        const result = createWebhookSchema.safeParse({
          name: 'Test',
          url: 'https://example.com/webhook',
          events: [event],
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid event type', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['invalid.event'],
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept optional secret', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
        secret: 'my-secret-key-1234',
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject secret shorter than 16 characters', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
        secret: 'short',
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept custom headers', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
        headers: {
          'X-Custom-Header': 'value',
          Authorization: 'Bearer token',
        },
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBeUndefined();
        expect(result.data.retry_count).toBeUndefined();
        expect(result.data.timeout_ms).toBeUndefined();
        expect(result.data.headers).toBeUndefined();
      }
    });

    it('should reject retry_count > 10', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
        retry_count: 15,
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject timeout_ms > 60000', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
        timeout_ms: 120000,
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject timeout_ms < 1000', () => {
      const input = {
        name: 'My Webhook',
        url: 'https://example.com/webhook',
        events: ['person.created'],
        timeout_ms: 500,
      };

      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateWebhookSchema', () => {
    it('should allow partial updates', () => {
      const input = {
        name: 'Updated Name',
      };

      const result = updateWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow nullable secret', () => {
      const input = {
        secret: null,
      };

      const result = updateWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate URL if provided', () => {
      const input = {
        url: 'not-a-url',
      };

      const result = updateWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require at least one event if events provided', () => {
      const input = {
        events: [],
      };

      const result = updateWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('webhookQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        is_active: 'true',
        limit: '10',
        offset: '20',
      };

      const result = webhookQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(true);
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(20);
      }
    });

    it('should transform is_active string to boolean', () => {
      const trueResult = webhookQuerySchema.safeParse({ is_active: 'true' });
      expect(trueResult.success).toBe(true);
      if (trueResult.success) {
        expect(trueResult.data.is_active).toBe(true);
      }

      const falseResult = webhookQuerySchema.safeParse({ is_active: 'false' });
      expect(falseResult.success).toBe(true);
      if (falseResult.success) {
        expect(falseResult.data.is_active).toBe(false);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};
      const result = webhookQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('webhookDeliveryQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        status: 'delivered',
        event_type: 'person.created',
        limit: '25',
        offset: '10',
      };

      const result = webhookDeliveryQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('delivered');
        expect(result.data.event_type).toBe('person.created');
      }
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'delivered', 'failed', 'retrying'];

      for (const status of statuses) {
        const result = webhookDeliveryQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const input = { status: 'invalid' };
      const result = webhookDeliveryQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should use default limit of 50', () => {
      const input = {};
      const result = webhookDeliveryQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });
  });

  describe('testWebhookSchema', () => {
    it('should validate a valid test request', () => {
      const input = {
        event_type: 'person.created',
      };

      const result = testWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require event_type', () => {
      const input = {};

      const result = testWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept optional payload', () => {
      const input = {
        event_type: 'person.created',
        payload: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };

      const result = testWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should use default empty payload', () => {
      const input = {
        event_type: 'person.created',
      };

      const result = testWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload).toEqual({});
      }
    });

    it('should reject invalid event_type', () => {
      const input = {
        event_type: 'invalid.event',
      };

      const result = testWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
