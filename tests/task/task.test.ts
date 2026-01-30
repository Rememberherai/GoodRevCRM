import { describe, it, expect } from 'vitest';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
} from '@/lib/validators/task';

describe('Task Validators', () => {
  describe('createTaskSchema', () => {
    it('should validate a valid task', () => {
      const validTask = {
        title: 'Follow up with client',
        description: 'Call to discuss proposal',
        status: 'pending',
        priority: 'high',
        due_date: '2025-02-15T10:00:00Z',
      };

      const result = createTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
    });

    it('should require title', () => {
      const invalidTask = {
        description: 'Some description',
        status: 'pending',
      };

      const result = createTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should validate status enum', () => {
      const invalidTask = {
        title: 'Task',
        status: 'invalid_status',
      };

      const result = createTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should validate priority enum', () => {
      const invalidTask = {
        title: 'Task',
        priority: 'invalid_priority',
      };

      const result = createTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];

      for (const status of statuses) {
        const result = createTaskSchema.safeParse({
          title: 'Task',
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid priorities', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];

      for (const priority of priorities) {
        const result = createTaskSchema.safeParse({
          title: 'Task',
          priority,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate optional entity IDs as UUIDs', () => {
      const validTask = {
        title: 'Task',
        person_id: '123e4567-e89b-12d3-a456-426614174000',
        organization_id: '123e4567-e89b-12d3-a456-426614174001',
        opportunity_id: '123e4567-e89b-12d3-a456-426614174002',
        rfp_id: '123e4567-e89b-12d3-a456-426614174003',
      };

      const result = createTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUIDs for entity IDs', () => {
      const invalidTask = {
        title: 'Task',
        person_id: 'not-a-uuid',
      };

      const result = createTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });

    it('should validate assigned_to as UUID', () => {
      const validTask = {
        title: 'Task',
        assigned_to: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
    });

    it('should enforce max title length', () => {
      const invalidTask = {
        title: 'a'.repeat(501),
      };

      const result = createTaskSchema.safeParse(invalidTask);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTaskSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        title: 'Updated title',
      };

      const result = updateTaskSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should allow updating status only', () => {
      const statusUpdate = {
        status: 'completed',
      };

      const result = updateTaskSchema.safeParse(statusUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate updated fields', () => {
      const invalidUpdate = {
        status: 'invalid_status',
      };

      const result = updateTaskSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should allow empty object (no updates)', () => {
      const result = updateTaskSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('taskQuerySchema', () => {
    it('should parse valid query params', () => {
      const query = {
        status: 'pending',
        priority: 'high',
        assigned_to: '123e4567-e89b-12d3-a456-426614174000',
        limit: '20',
        offset: '0',
      };

      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should use default limit and offset', () => {
      const query = {};

      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should filter by entity IDs', () => {
      const query = {
        person_id: '123e4567-e89b-12d3-a456-426614174000',
        organization_id: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('should reject limit > 100', () => {
      const query = {
        limit: '200',
      };

      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should accept limit at 100', () => {
      const query = {
        limit: '100',
      };

      const result = taskQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });
  });
});
