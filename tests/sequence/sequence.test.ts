import { describe, it, expect } from 'vitest';
import {
  createSequenceSchema,
  updateSequenceSchema,
  createStepSchema,
  updateStepSchema,
  enrollPersonSchema,
  bulkEnrollSchema,
  updateEnrollmentSchema,
  createSignatureSchema,
  sequenceQuerySchema,
  enrollmentQuerySchema,
} from '@/lib/validators/sequence';

describe('Sequence Validators', () => {
  describe('createSequenceSchema', () => {
    it('validates a valid sequence', () => {
      const result = createSequenceSchema.safeParse({
        name: 'Welcome Sequence',
        description: 'Onboarding sequence for new leads',
      });
      expect(result.success).toBe(true);
    });

    it('validates with settings', () => {
      const result = createSequenceSchema.safeParse({
        name: 'Sales Sequence',
        settings: {
          send_as_reply: false,
          stop_on_reply: true,
          stop_on_bounce: true,
          track_opens: true,
          track_clicks: true,
          send_window_start: '09:00',
          send_window_end: '17:00',
          send_days: [1, 2, 3, 4, 5],
          timezone: 'America/New_York',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createSequenceSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects name over 200 chars', () => {
      const result = createSequenceSchema.safeParse({
        name: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid send window format', () => {
      const result = createSequenceSchema.safeParse({
        name: 'Test',
        settings: {
          send_window_start: '9:00', // Should be 09:00
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateSequenceSchema', () => {
    it('validates partial updates', () => {
      const result = updateSequenceSchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('validates status change', () => {
      const statuses = ['draft', 'active', 'paused', 'archived'] as const;
      for (const status of statuses) {
        const result = updateSequenceSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      const result = updateSequenceSchema.safeParse({
        status: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createStepSchema', () => {
    it('validates email step', () => {
      const result = createStepSchema.safeParse({
        step_type: 'email',
        subject: 'Hello {{first_name}}',
        body_html: '<p>Welcome to our platform!</p>',
      });
      expect(result.success).toBe(true);
    });

    it('validates delay step', () => {
      const result = createStepSchema.safeParse({
        step_type: 'delay',
        delay_amount: 3,
        delay_unit: 'days',
      });
      expect(result.success).toBe(true);
    });

    it('validates condition step', () => {
      const result = createStepSchema.safeParse({
        step_type: 'condition',
        condition: {
          type: 'opened',
          step_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      });
      expect(result.success).toBe(true);
    });

    it('validates all delay units', () => {
      const units = ['minutes', 'hours', 'days', 'weeks'] as const;
      for (const unit of units) {
        const result = createStepSchema.safeParse({
          step_type: 'delay',
          delay_amount: 1,
          delay_unit: unit,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid step type', () => {
      const result = createStepSchema.safeParse({
        step_type: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects delay amount less than 1', () => {
      const result = createStepSchema.safeParse({
        step_type: 'delay',
        delay_amount: 0,
        delay_unit: 'days',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStepSchema', () => {
    it('validates partial step updates', () => {
      const result = updateStepSchema.safeParse({
        subject: 'Updated subject',
      });
      expect(result.success).toBe(true);
    });

    it('validates step number update', () => {
      const result = updateStepSchema.safeParse({
        step_number: 5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('enrollPersonSchema', () => {
    it('validates enrollment', () => {
      const result = enrollPersonSchema.safeParse({
        person_id: '550e8400-e29b-41d4-a716-446655440000',
        gmail_connection_id: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });

    it('validates with start time', () => {
      const result = enrollPersonSchema.safeParse({
        person_id: '550e8400-e29b-41d4-a716-446655440000',
        gmail_connection_id: '550e8400-e29b-41d4-a716-446655440001',
        start_at: '2024-01-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      const result = enrollPersonSchema.safeParse({
        person_id: 'not-a-uuid',
        gmail_connection_id: 'also-not-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkEnrollSchema', () => {
    it('validates bulk enrollment', () => {
      const result = bulkEnrollSchema.safeParse({
        person_ids: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ],
        gmail_connection_id: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty person_ids', () => {
      const result = bulkEnrollSchema.safeParse({
        person_ids: [],
        gmail_connection_id: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 100 person_ids', () => {
      const ids = Array.from({ length: 101 }, (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`
      );
      const result = bulkEnrollSchema.safeParse({
        person_ids: ids,
        gmail_connection_id: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateEnrollmentSchema', () => {
    it('validates status update', () => {
      const statuses = ['active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed'] as const;
      for (const status of statuses) {
        const result = updateEnrollmentSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('validates step update', () => {
      const result = updateEnrollmentSchema.safeParse({
        current_step: 3,
      });
      expect(result.success).toBe(true);
    });

    it('validates next send time', () => {
      const result = updateEnrollmentSchema.safeParse({
        next_send_at: '2024-01-15T10:00:00Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createSignatureSchema', () => {
    it('validates signature', () => {
      const result = createSignatureSchema.safeParse({
        name: 'Professional',
        content_html: '<p>Best regards,<br>John Doe</p>',
        is_default: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createSignatureSchema.safeParse({
        name: '',
        content_html: '<p>Content</p>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty content', () => {
      const result = createSignatureSchema.safeParse({
        name: 'Test',
        content_html: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sequenceQuerySchema', () => {
    it('validates with all parameters', () => {
      const result = sequenceQuerySchema.safeParse({
        status: 'active',
        limit: 25,
        offset: 10,
      });
      expect(result.success).toBe(true);
    });

    it('validates with defaults', () => {
      const result = sequenceQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('coerces string numbers', () => {
      const result = sequenceQuerySchema.safeParse({
        limit: '30',
        offset: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(30);
        expect(result.data.offset).toBe(5);
      }
    });
  });

  describe('enrollmentQuerySchema', () => {
    it('validates with filters', () => {
      const result = enrollmentQuerySchema.safeParse({
        sequence_id: '550e8400-e29b-41d4-a716-446655440000',
        person_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'active',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Sequence Types', () => {
  it('has all sequence status values', () => {
    const statuses: ('draft' | 'active' | 'paused' | 'archived')[] = [
      'draft', 'active', 'paused', 'archived',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('has all enrollment status values', () => {
    const statuses: ('active' | 'paused' | 'completed' | 'bounced' | 'replied' | 'unsubscribed')[] = [
      'active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('has all step types', () => {
    const types: ('email' | 'delay' | 'condition')[] = ['email', 'delay', 'condition'];
    expect(types).toHaveLength(3);
  });

  it('has all delay units', () => {
    const units: ('minutes' | 'hours' | 'days' | 'weeks')[] = [
      'minutes', 'hours', 'days', 'weeks',
    ];
    expect(units).toHaveLength(4);
  });
});
