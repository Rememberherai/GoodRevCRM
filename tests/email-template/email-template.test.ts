import { describe, it, expect } from 'vitest';
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  renderTemplateSchema,
  createDraftSchema,
  updateDraftSchema,
  draftQuerySchema,
  templateVariableSchema,
  versionQuerySchema,
  createAttachmentSchema,
} from '@/lib/validators/email-template';

describe('Email Template Validators', () => {
  describe('templateVariableSchema', () => {
    it('should validate a valid variable', () => {
      const input = {
        name: 'first_name',
        label: 'First Name',
        type: 'text',
        required: false,
      };

      const result = templateVariableSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require valid name format', () => {
      const input = {
        name: 'invalid-name',
        label: 'Test',
        type: 'text',
        required: false,
      };

      const result = templateVariableSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid types', () => {
      const types = ['text', 'date', 'number', 'email', 'url'];

      for (const type of types) {
        const result = templateVariableSchema.safeParse({
          name: 'test_var',
          label: 'Test',
          type,
          required: true,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject name starting with number', () => {
      const input = {
        name: '1invalid',
        label: 'Test',
        type: 'text',
        required: false,
      };

      const result = templateVariableSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createTemplateSchema', () => {
    it('should validate a complete template', () => {
      const input = {
        name: 'Welcome Email',
        description: 'Sent to new users',
        subject: 'Welcome to {{company}}!',
        body_html: '<p>Hello {{first_name}}</p>',
        body_text: 'Hello {{first_name}}',
        category: 'outreach',
        variables: [
          { name: 'first_name', label: 'First Name', type: 'text', required: true },
        ],
        is_active: true,
        is_shared: false,
      };

      const result = createTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name, subject, and body_html', () => {
      const input = {};

      const result = createTemplateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept minimal template', () => {
      const input = {
        name: 'Simple',
        subject: 'Hello',
        body_html: '<p>Content</p>',
      };

      const result = createTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid categories', () => {
      const categories = [
        'outreach', 'follow_up', 'introduction', 'proposal', 'thank_you',
        'meeting', 'reminder', 'newsletter', 'announcement', 'other',
      ];

      for (const category of categories) {
        const result = createTemplateSchema.safeParse({
          name: 'Test',
          subject: 'Test',
          body_html: '<p>Test</p>',
          category,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject subject longer than 500 characters', () => {
      const input = {
        name: 'Test',
        subject: 'a'.repeat(501),
        body_html: '<p>Test</p>',
      };

      const result = createTemplateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject body_html longer than 100000 characters', () => {
      const input = {
        name: 'Test',
        subject: 'Test',
        body_html: '<p>' + 'a'.repeat(100001) + '</p>',
      };

      const result = createTemplateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTemplateSchema', () => {
    it('should allow partial updates', () => {
      const input = {
        name: 'Updated Name',
      };

      const result = updateTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate variables in update', () => {
      const input = {
        variables: [
          { name: 'valid_name', label: 'Label', type: 'text', required: false },
        ],
      };

      const result = updateTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('templateQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        category: 'outreach',
        is_active: 'true',
        is_shared: 'false',
        search: 'welcome',
        limit: '25',
        offset: '10',
      };

      const result = templateQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('outreach');
        expect(result.data.is_active).toBe(true);
        expect(result.data.is_shared).toBe(false);
        expect(result.data.search).toBe('welcome');
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = templateQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject invalid category', () => {
      const input = { category: 'invalid' };

      const result = templateQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('renderTemplateSchema', () => {
    it('should validate valid variables', () => {
      const input = {
        variables: {
          first_name: 'John',
          last_name: 'Doe',
          amount: 100,
          active: true,
        },
      };

      const result = renderTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept null values', () => {
      const input = {
        variables: {
          first_name: null,
        },
      };

      const result = renderTemplateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require variables object', () => {
      const input = {};

      const result = renderTemplateSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createDraftSchema', () => {
    it('should validate a complete draft', () => {
      const input = {
        template_id: '550e8400-e29b-41d4-a716-446655440000',
        person_id: '550e8400-e29b-41d4-a716-446655440001',
        subject: 'Meeting Request',
        body_html: '<p>Hi there</p>',
        body_text: 'Hi there',
        to_addresses: ['john@example.com'],
        cc_addresses: ['manager@example.com'],
        bcc_addresses: ['archive@example.com'],
        reply_to: 'sales@example.com',
        scheduled_at: '2024-12-15T10:00:00Z',
      };

      const result = createDraftSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require to_addresses with at least one email', () => {
      const input = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        to_addresses: [],
      };

      const result = createDraftSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept minimal draft', () => {
      const input = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        to_addresses: ['test@example.com'],
      };

      const result = createDraftSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const input = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        to_addresses: ['invalid-email'],
      };

      const result = createDraftSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow nullable template_id', () => {
      const input = {
        subject: 'Test',
        body_html: '<p>Test</p>',
        to_addresses: ['test@example.com'],
        template_id: null,
      };

      const result = createDraftSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('updateDraftSchema', () => {
    it('should allow partial updates', () => {
      const input = {
        subject: 'Updated Subject',
      };

      const result = updateDraftSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow status change to scheduled', () => {
      const input = {
        status: 'scheduled',
        scheduled_at: '2024-12-15T10:00:00Z',
      };

      const result = updateDraftSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should not allow status change to sent or failed', () => {
      const input = {
        status: 'sent',
      };

      const result = updateDraftSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should allow empty update', () => {
      const input = {};

      const result = updateDraftSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('draftQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        status: 'draft',
        template_id: '550e8400-e29b-41d4-a716-446655440000',
        limit: '30',
        offset: '5',
      };

      const result = draftQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('draft');
        expect(result.data.limit).toBe(30);
        expect(result.data.offset).toBe(5);
      }
    });

    it('should accept all valid statuses', () => {
      const statuses = ['draft', 'scheduled', 'sending', 'sent', 'failed'];

      for (const status of statuses) {
        const result = draftQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should use default limit and offset', () => {
      const input = {};

      const result = draftQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
      }
    });
  });

  describe('versionQuerySchema', () => {
    it('should parse valid query', () => {
      const input = {
        limit: '25',
        offset: '5',
      };

      const result = versionQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(5);
      }
    });

    it('should use defaults', () => {
      const input = {};

      const result = versionQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should reject limit > 50', () => {
      const input = { limit: '100' };

      const result = versionQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('createAttachmentSchema', () => {
    it('should validate a valid attachment', () => {
      const input = {
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 1024000,
        file_url: 'https://storage.example.com/doc.pdf',
      };

      const result = createAttachmentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject file > 10MB', () => {
      const input = {
        file_name: 'big.pdf',
        file_type: 'application/pdf',
        file_size: 20000000,
        file_url: 'https://storage.example.com/big.pdf',
      };

      const result = createAttachmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require valid URL', () => {
      const input = {
        file_name: 'doc.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        file_url: 'not-a-url',
      };

      const result = createAttachmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require all fields', () => {
      const input = {
        file_name: 'doc.pdf',
      };

      const result = createAttachmentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
