import { describe, expect, it } from 'vitest';

import { MERGE_FIELD_OPTIONS, VALID_MERGE_FIELD_KEYS } from '@/lib/contracts/merge-field-keys';
import {
  contractFieldSchema,
  createContractDocumentSchema,
  createContractRecipientSchema,
  createContractTemplateSchema,
  submitSigningSchema,
} from '@/lib/validators/contract';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Contract Validators', () => {
  describe('createContractDocumentSchema', () => {
    it('accepts notification preference flags', () => {
      const result = createContractDocumentSchema.safeParse({
        title: 'MSA',
        original_file_path: 'project/documents/test.pdf',
        original_file_name: 'test.pdf',
        notify_on_view: false,
        notify_on_sign: true,
        notify_on_decline: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('createContractRecipientSchema', () => {
    it('accepts signer recipients', () => {
      const result = createContractRecipientSchema.safeParse({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'signer',
        signing_order: 1,
      });

      expect(result.success).toBe(true);
    });

    it('rejects unsupported non-signer recipient roles', () => {
      const result = createContractRecipientSchema.safeParse({
        name: 'Legal',
        email: 'legal@example.com',
        role: 'cc',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('contractFieldSchema', () => {
    it('accepts a valid merge field key', () => {
      const result = contractFieldSchema.safeParse({
        recipient_id: VALID_UUID,
        field_type: 'text_input',
        page_number: 1,
        x: 10,
        y: 20,
        width: 25,
        height: 8,
        auto_populate_from: 'person.full_name',
      });

      expect(result.success).toBe(true);
    });

    it('rejects an invalid merge field key', () => {
      const result = contractFieldSchema.safeParse({
        recipient_id: VALID_UUID,
        field_type: 'text_input',
        page_number: 1,
        x: 10,
        y: 20,
        width: 25,
        height: 8,
        auto_populate_from: 'person.favorite_color',
      });

      expect(result.success).toBe(false);
    });

    it('rejects zero-sized fields', () => {
      const result = contractFieldSchema.safeParse({
        recipient_id: VALID_UUID,
        field_type: 'signature',
        page_number: 1,
        x: 10,
        y: 20,
        width: 0,
        height: 10,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createContractTemplateSchema', () => {
    it('rejects invalid template auto-populate keys', () => {
      const result = createContractTemplateSchema.safeParse({
        name: 'Template',
        file_path: 'project/templates/template.pdf',
        file_name: 'template.pdf',
        fields: [
          {
            field_type: 'text_input',
            role_name: 'Client',
            is_required: true,
            page_number: 1,
            x: 10,
            y: 10,
            width: 20,
            height: 10,
            auto_populate_from: 'opportunity.stage_name',
          },
        ],
      });

      expect(result.success).toBe(false);
    });
  });

  describe('submitSigningSchema', () => {
    it('accepts initials_data when provided', () => {
      const result = submitSigningSchema.safeParse({
        fields: [{ field_id: VALID_UUID, value: 'adopted' }],
        signature_data: {
          type: 'type',
          data: 'Jane Doe',
          font: 'Dancing Script',
        },
        initials_data: {
          type: 'draw',
          data: 'data:image/png;base64,abc123',
        },
      });

      expect(result.success).toBe(true);
    });

    it('allows initials_data to be omitted', () => {
      const result = submitSigningSchema.safeParse({
        fields: [{ field_id: VALID_UUID, value: 'adopted' }],
        signature_data: {
          type: 'type',
          data: 'Jane Doe',
          font: 'Dancing Script',
        },
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('Merge Field Keys', () => {
  it('keeps the allowlist in sync with the option list', () => {
    const optionKeys = new Set(MERGE_FIELD_OPTIONS.map((option) => option.key));

    expect(optionKeys).toEqual(VALID_MERGE_FIELD_KEYS);
    expect(optionKeys.size).toBeGreaterThan(0);
  });

  it('includes the supported contract merge keys', () => {
    expect(VALID_MERGE_FIELD_KEYS.has('person.full_name')).toBe(true);
    expect(VALID_MERGE_FIELD_KEYS.has('organization.name')).toBe(true);
    expect(VALID_MERGE_FIELD_KEYS.has('opportunity.amount')).toBe(true);
    expect(VALID_MERGE_FIELD_KEYS.has('date.today')).toBe(true);
  });
});
