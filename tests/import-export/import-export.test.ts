import { describe, it, expect } from 'vitest';
import {
  createImportJobSchema,
  updateImportJobSchema,
  createExportJobSchema,
  updateExportJobSchema,
  importJobQuerySchema,
  exportJobQuerySchema,
  personImportRowSchema,
  organizationImportRowSchema,
  opportunityImportRowSchema,
  taskImportRowSchema,
} from '@/lib/validators/import-export';

describe('Import Job Validators', () => {
  describe('createImportJobSchema', () => {
    it('should validate a valid import job', () => {
      const input = {
        entity_type: 'person',
        file_name: 'contacts.csv',
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require entity_type', () => {
      const input = {
        file_name: 'contacts.csv',
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require file_name', () => {
      const input = {
        entity_type: 'person',
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid entity types', () => {
      const entityTypes = ['person', 'organization', 'opportunity', 'task'];

      for (const type of entityTypes) {
        const result = createImportJobSchema.safeParse({
          entity_type: type,
          file_name: 'test.csv',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept mapping', () => {
      const input = {
        entity_type: 'person',
        file_name: 'contacts.csv',
        mapping: {
          'First Name': 'first_name',
          'Last Name': 'last_name',
        },
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept options', () => {
      const input = {
        entity_type: 'person',
        file_name: 'contacts.csv',
        options: {
          skip_duplicates: true,
          update_existing: true,
          duplicate_key: 'email',
          skip_header: true,
          delimiter: ';',
        },
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should use default options', () => {
      const input = {
        entity_type: 'person',
        file_name: 'contacts.csv',
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.options).toEqual({});
        expect(result.data.mapping).toEqual({});
      }
    });

    it('should reject invalid entity type', () => {
      const input = {
        entity_type: 'invalid',
        file_name: 'test.csv',
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject file_name longer than 255 characters', () => {
      const input = {
        entity_type: 'person',
        file_name: 'a'.repeat(256),
      };

      const result = createImportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateImportJobSchema', () => {
    it('should validate status update', () => {
      const input = { status: 'processing' };
      const result = updateImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate progress updates', () => {
      const input = {
        total_rows: 100,
        processed_rows: 50,
        successful_rows: 45,
        failed_rows: 5,
      };
      const result = updateImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate error_log', () => {
      const input = {
        error_log: [
          { row: 5, message: 'Invalid email' },
          { row: 10, field: 'phone', message: 'Invalid format', value: 'abc' },
        ],
      };
      const result = updateImportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid statuses', () => {
      const statuses = [
        'pending',
        'validating',
        'processing',
        'completed',
        'failed',
        'cancelled',
      ];

      for (const status of statuses) {
        const result = updateImportJobSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject negative row counts', () => {
      const input = { processed_rows: -1 };
      const result = updateImportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('importJobQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        entity_type: 'person',
        status: 'completed',
        limit: '10',
        offset: '20',
      };

      const result = importJobQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(20);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};
      const result = importJobQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit > 100', () => {
      const input = { limit: '200' };
      const result = importJobQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('Export Job Validators', () => {
  describe('createExportJobSchema', () => {
    it('should validate a valid export job', () => {
      const input = {
        entity_type: 'person',
      };

      const result = createExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept format', () => {
      const input = {
        entity_type: 'person',
        format: 'xlsx',
      };

      const result = createExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid formats', () => {
      const formats = ['csv', 'xlsx', 'json'];

      for (const format of formats) {
        const result = createExportJobSchema.safeParse({
          entity_type: 'person',
          format,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept filters', () => {
      const input = {
        entity_type: 'person',
        filters: {
          status: 'active',
          created_after: '2025-01-01',
        },
      };

      const result = createExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept columns', () => {
      const input = {
        entity_type: 'person',
        columns: ['first_name', 'last_name', 'email'],
      };

      const result = createExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should use default format', () => {
      const input = { entity_type: 'person' };
      const result = createExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe('csv');
      }
    });

    it('should reject invalid format', () => {
      const input = {
        entity_type: 'person',
        format: 'pdf',
      };

      const result = createExportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateExportJobSchema', () => {
    it('should validate status update', () => {
      const input = { status: 'completed' };
      const result = updateExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate file info', () => {
      const input = {
        file_name: 'export_2025.csv',
        file_url: 'https://storage.example.com/exports/export_2025.csv',
      };
      const result = updateExportJobSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'processing', 'completed', 'failed', 'expired'];

      for (const status of statuses) {
        const result = updateExportJobSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid URL', () => {
      const input = { file_url: 'not-a-url' };
      const result = updateExportJobSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('exportJobQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        entity_type: 'organization',
        status: 'completed',
        limit: '15',
        offset: '5',
      };

      const result = exportJobQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(15);
        expect(result.data.offset).toBe(5);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};
      const result = exportJobQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
  });
});

describe('Import Row Validators', () => {
  describe('personImportRowSchema', () => {
    it('should validate a valid person row', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      };

      const result = personImportRowSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require first_name', () => {
      const input = {
        last_name: 'Doe',
      };

      const result = personImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require last_name', () => {
      const input = {
        first_name: 'John',
      };

      const result = personImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'not-an-email',
      };

      const result = personImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow null optional fields', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        email: null,
        phone: null,
      };

      const result = personImportRowSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('organizationImportRowSchema', () => {
    it('should validate a valid organization row', () => {
      const input = {
        name: 'Acme Corp',
        domain: 'acme.com',
      };

      const result = organizationImportRowSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const input = {
        domain: 'acme.com',
      };

      const result = organizationImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('opportunityImportRowSchema', () => {
    it('should validate a valid opportunity row', () => {
      // Note: opportunities use 'name' (not title) and 'amount' (not value)
      const input = {
        name: 'New Deal',
        amount: 50000,
        probability: 75,
      };

      const result = opportunityImportRowSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const input = {
        amount: 50000,
      };

      const result = opportunityImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should coerce amount to number', () => {
      const input = {
        name: 'New Deal',
        amount: '50000',
      };

      const result = opportunityImportRowSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(50000);
      }
    });

    it('should reject probability > 100', () => {
      const input = {
        name: 'New Deal',
        probability: 150,
      };

      const result = opportunityImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('taskImportRowSchema', () => {
    it('should validate a valid task row', () => {
      const input = {
        title: 'Follow up with client',
        status: 'pending',
        priority: 'high',
      };

      const result = taskImportRowSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require title', () => {
      const input = {
        status: 'pending',
      };

      const result = taskImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject title longer than 500 characters', () => {
      const input = {
        title: 'a'.repeat(501),
      };

      const result = taskImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const input = {
        title: 'Task',
        status: 'invalid_status',
      };

      const result = taskImportRowSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid statuses', () => {
      const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];

      for (const status of statuses) {
        const result = taskImportRowSchema.safeParse({
          title: 'Task',
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid priorities', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];

      for (const priority of priorities) {
        const result = taskImportRowSchema.safeParse({
          title: 'Task',
          priority,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
