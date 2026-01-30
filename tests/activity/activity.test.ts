import { describe, it, expect } from 'vitest';
import { activityQuerySchema, createActivitySchema } from '@/lib/validators/activity';

describe('Activity Validators', () => {
  describe('activityQuerySchema', () => {
    it('should parse valid query params', () => {
      const query = {
        entity_type: 'person',
        action: 'created',
        limit: '20',
        offset: '0',
      };

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entity_type).toBe('person');
        expect(result.data.action).toBe('created');
        expect(result.data.limit).toBe(20);
      }
    });

    it('should use default limit and offset', () => {
      const query = {};

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should accept all valid entity types', () => {
      const entityTypes = [
        'person',
        'organization',
        'opportunity',
        'rfp',
        'task',
        'note',
        'sequence',
        'email',
      ];

      for (const type of entityTypes) {
        const result = activityQuerySchema.safeParse({ entity_type: type });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid actions', () => {
      const actions = [
        'created',
        'updated',
        'deleted',
        'restored',
        'assigned',
        'unassigned',
        'status_changed',
        'stage_changed',
        'enrolled',
        'unenrolled',
        'sent',
        'opened',
        'clicked',
        'replied',
      ];

      for (const action of actions) {
        const result = activityQuerySchema.safeParse({ action });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid entity type', () => {
      const query = {
        entity_type: 'invalid_type',
      };

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should reject invalid action', () => {
      const query = {
        action: 'invalid_action',
      };

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should filter by user_id', () => {
      const query = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('should filter by date range', () => {
      const query = {
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2025-12-31T23:59:59Z',
      };

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('should reject limit > 100', () => {
      const query = {
        limit: '200',
      };

      const result = activityQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe('createActivitySchema', () => {
    it('should validate a valid activity', () => {
      const activity = {
        entity_type: 'person',
        entity_id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'created',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should require entity_type', () => {
      const activity = {
        entity_id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'created',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });

    it('should require entity_id', () => {
      const activity = {
        entity_type: 'person',
        action: 'created',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });

    it('should require action', () => {
      const activity = {
        entity_type: 'person',
        entity_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });

    it('should accept changes object', () => {
      const activity = {
        entity_type: 'person',
        entity_id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'updated',
        changes: {
          name: { old: 'John', new: 'Jane' },
          email: { old: 'john@example.com', new: 'jane@example.com' },
        },
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should accept metadata object', () => {
      const activity = {
        entity_type: 'email',
        entity_id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'sent',
        metadata: {
          recipient: 'test@example.com',
          subject: 'Hello',
        },
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should default changes to empty object', () => {
      const activity = {
        entity_type: 'person',
        entity_id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'created',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.changes).toEqual({});
      }
    });

    it('should reject invalid entity_id format', () => {
      const activity = {
        entity_type: 'person',
        entity_id: 'not-a-uuid',
        action: 'created',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });
  });
});
