import { describe, it, expect } from 'vitest';
import {
  bulkOperationSchema,
  bulkPersonUpdateSchema,
  bulkOrganizationUpdateSchema,
  bulkOpportunityUpdateSchema,
  bulkTaskUpdateSchema,
  createTagSchema,
  updateTagSchema,
  bulkTagOperationSchema,
  tagQuerySchema,
} from '@/lib/validators/bulk';

describe('Bulk Operation Validators', () => {
  describe('bulkOperationSchema', () => {
    it('should validate a valid bulk operation', () => {
      const input = {
        entity_type: 'person',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        operation: 'delete',
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require at least one entity ID', () => {
      const input = {
        entity_type: 'person',
        entity_ids: [],
        operation: 'delete',
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject more than 100 entity IDs', () => {
      const input = {
        entity_type: 'person',
        entity_ids: Array(101)
          .fill(null)
          .map(() => '123e4567-e89b-12d3-a456-426614174000'),
        operation: 'delete',
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid entity types', () => {
      const entityTypes = ['person', 'organization', 'opportunity', 'task'];

      for (const type of entityTypes) {
        const result = bulkOperationSchema.safeParse({
          entity_type: type,
          entity_ids: ['123e4567-e89b-12d3-a456-426614174000'],
          operation: 'delete',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid operations', () => {
      const operations = [
        'update',
        'delete',
        'restore',
        'assign',
        'unassign',
        'add_tags',
        'remove_tags',
        'complete',
      ];

      for (const op of operations) {
        const result = bulkOperationSchema.safeParse({
          entity_type: 'task',
          entity_ids: ['123e4567-e89b-12d3-a456-426614174000'],
          operation: op,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept optional data', () => {
      const input = {
        entity_type: 'person',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        operation: 'update',
        data: { status: 'active' },
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid entity type', () => {
      const input = {
        entity_type: 'invalid',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        operation: 'delete',
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid operation', () => {
      const input = {
        entity_type: 'person',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        operation: 'invalid_operation',
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID in entity_ids', () => {
      const input = {
        entity_type: 'person',
        entity_ids: ['not-a-uuid'],
        operation: 'delete',
      };

      const result = bulkOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('bulkPersonUpdateSchema', () => {
    it('should validate status update', () => {
      const input = { status: 'active' };
      const result = bulkPersonUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate owner_id update', () => {
      const input = { owner_id: '123e4567-e89b-12d3-a456-426614174000' };
      const result = bulkPersonUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update object', () => {
      const input = {};
      const result = bulkPersonUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid owner_id', () => {
      const input = { owner_id: 'not-a-uuid' };
      const result = bulkPersonUpdateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('bulkOrganizationUpdateSchema', () => {
    it('should validate status update', () => {
      // Valid organization statuses: prospect, customer, partner, vendor, inactive
      const input = { status: 'customer' };
      const result = bulkOrganizationUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate owner_id update', () => {
      const input = { owner_id: '123e4567-e89b-12d3-a456-426614174000' };
      const result = bulkOrganizationUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid organization statuses', () => {
      const statuses = ['prospect', 'customer', 'partner', 'vendor', 'inactive'];
      for (const status of statuses) {
        const result = bulkOrganizationUpdateSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid organization status', () => {
      const result = bulkOrganizationUpdateSchema.safeParse({ status: 'active' });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkOpportunityUpdateSchema', () => {
    it('should validate stage update', () => {
      const input = { stage: 'negotiation' };
      const result = bulkOpportunityUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate combined updates', () => {
      // Note: opportunities use 'stage' not 'status' - there is no status field
      const input = {
        stage: 'closed_won',
        owner_id: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = bulkOpportunityUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid opportunity stages', () => {
      const stages = [
        'prospecting',
        'qualification',
        'proposal',
        'negotiation',
        'closed_won',
        'closed_lost',
      ];
      for (const stage of stages) {
        const result = bulkOpportunityUpdateSchema.safeParse({ stage });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid stages', () => {
      const result = bulkOpportunityUpdateSchema.safeParse({ stage: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkTaskUpdateSchema', () => {
    it('should validate status update', () => {
      const input = { status: 'completed' };
      const result = bulkTaskUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate priority update', () => {
      const input = { priority: 'high' };
      const result = bulkTaskUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate assignee_id update', () => {
      const input = { assignee_id: '123e4567-e89b-12d3-a456-426614174000' };
      const result = bulkTaskUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate due_date update', () => {
      const input = { due_date: '2025-12-31T23:59:59Z' };
      const result = bulkTaskUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const input = { status: 'invalid_status' };
      const result = bulkTaskUpdateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid priority', () => {
      const input = { priority: 'super_high' };
      const result = bulkTaskUpdateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      for (const status of statuses) {
        const result = bulkTaskUpdateSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid priorities', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      for (const priority of priorities) {
        const result = bulkTaskUpdateSchema.safeParse({ priority });
        expect(result.success).toBe(true);
      }
    });
  });
});

describe('Tag Validators', () => {
  describe('createTagSchema', () => {
    it('should validate a valid tag', () => {
      const input = {
        name: 'Important',
        color: '#ff5733',
      };

      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const input = {
        color: '#ff5733',
      };

      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should default color', () => {
      const input = {
        name: 'Important',
      };

      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe('#6366f1');
      }
    });

    it('should reject invalid color format', () => {
      const input = {
        name: 'Important',
        color: 'red',
      };

      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const input = {
        name: 'a'.repeat(101),
      };

      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
      };

      const result = createTagSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTagSchema', () => {
    it('should allow partial updates', () => {
      const input = {
        name: 'Updated Name',
      };

      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow color only update', () => {
      const input = {
        color: '#123456',
      };

      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateTagSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('bulkTagOperationSchema', () => {
    it('should validate a valid tag operation', () => {
      const input = {
        tag_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        entity_type: 'person',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174001'],
      };

      const result = bulkTagOperationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require at least one tag_id', () => {
      const input = {
        tag_ids: [],
        entity_type: 'person',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174001'],
      };

      const result = bulkTagOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject more than 10 tag_ids', () => {
      const input = {
        tag_ids: Array(11)
          .fill(null)
          .map(() => '123e4567-e89b-12d3-a456-426614174000'),
        entity_type: 'person',
        entity_ids: ['123e4567-e89b-12d3-a456-426614174001'],
      };

      const result = bulkTagOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require at least one entity_id', () => {
      const input = {
        tag_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        entity_type: 'person',
        entity_ids: [],
      };

      const result = bulkTagOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject more than 100 entity_ids', () => {
      const input = {
        tag_ids: ['123e4567-e89b-12d3-a456-426614174000'],
        entity_type: 'person',
        entity_ids: Array(101)
          .fill(null)
          .map(() => '123e4567-e89b-12d3-a456-426614174001'),
      };

      const result = bulkTagOperationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('tagQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        search: 'important',
        limit: '20',
        offset: '0',
      };

      const result = tagQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('important');
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = tagQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit > 100', () => {
      const input = {
        limit: '200',
      };

      const result = tagQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
