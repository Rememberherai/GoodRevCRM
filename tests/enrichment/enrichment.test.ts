import { describe, it, expect } from 'vitest';
import {
  enrichPersonSchema,
  bulkEnrichSchema,
  applyEnrichmentSchema,
  enrichmentHistoryQuerySchema,
  enrichmentWebhookSchema,
} from '@/lib/validators/enrichment';
import { mapEnrichmentToPerson, type EnrichmentPerson } from '@/lib/fullenrich/client';

describe('Enrichment Validators', () => {
  describe('enrichPersonSchema', () => {
    it('validates a valid person enrichment request', () => {
      const result = enrichPersonSchema.safeParse({
        person_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid UUID', () => {
      const result = enrichPersonSchema.safeParse({
        person_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing person_id', () => {
      const result = enrichPersonSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('bulkEnrichSchema', () => {
    it('validates a valid bulk enrichment request', () => {
      const result = bulkEnrichSchema.safeParse({
        person_ids: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty person_ids array', () => {
      const result = bulkEnrichSchema.safeParse({
        person_ids: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.person_ids).toBeDefined();
      }
    });

    it('rejects more than 100 person_ids', () => {
      const ids = Array.from({ length: 101 }, (_, i) =>
        `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`
      );
      const result = bulkEnrichSchema.safeParse({
        person_ids: ids,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUIDs in array', () => {
      const result = bulkEnrichSchema.safeParse({
        person_ids: ['valid-uuid-here', 'not-a-uuid'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('applyEnrichmentSchema', () => {
    it('validates a valid apply enrichment request', () => {
      const result = applyEnrichmentSchema.safeParse({
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        field_updates: [
          { field_name: 'email', value: 'test@example.com' },
          { field_name: 'phone', value: '+1234567890' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid job_id', () => {
      const result = applyEnrichmentSchema.safeParse({
        job_id: 'not-a-uuid',
        field_updates: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty field_name', () => {
      const result = applyEnrichmentSchema.safeParse({
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        field_updates: [{ field_name: '', value: 'test' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('enrichmentHistoryQuerySchema', () => {
    it('validates valid query parameters', () => {
      const result = enrichmentHistoryQuerySchema.safeParse({
        person_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'completed',
        limit: 50,
        offset: 0,
      });
      expect(result.success).toBe(true);
    });

    it('validates with no parameters', () => {
      const result = enrichmentHistoryQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('coerces string numbers to numbers', () => {
      const result = enrichmentHistoryQuerySchema.safeParse({
        limit: '25',
        offset: '10',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('validates all status values', () => {
      const statuses = ['pending', 'processing', 'completed', 'failed'] as const;
      for (const status of statuses) {
        const result = enrichmentHistoryQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid status', () => {
      const result = enrichmentHistoryQuerySchema.safeParse({
        status: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects limit over 100', () => {
      const result = enrichmentHistoryQuerySchema.safeParse({
        limit: 150,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative offset', () => {
      const result = enrichmentHistoryQuerySchema.safeParse({
        offset: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('enrichmentWebhookSchema', () => {
    it('validates a completed webhook payload', () => {
      const result = enrichmentWebhookSchema.safeParse({
        job_id: 'ext-job-123',
        status: 'completed',
        results: [
          {
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
            job_title: 'CEO',
            linkedin_url: 'https://linkedin.com/in/johndoe',
            phone: '+1234567890',
            location: {
              city: 'New York',
              state: 'NY',
              country: 'USA',
            },
            confidence_score: 0.95,
          },
        ],
        credits_used: 5,
      });
      expect(result.success).toBe(true);
    });

    it('validates a failed webhook payload', () => {
      const result = enrichmentWebhookSchema.safeParse({
        job_id: 'ext-job-123',
        status: 'failed',
        error: 'Rate limit exceeded',
      });
      expect(result.success).toBe(true);
    });

    it('validates webhook with empty results', () => {
      const result = enrichmentWebhookSchema.safeParse({
        job_id: 'ext-job-123',
        status: 'completed',
        results: [],
      });
      expect(result.success).toBe(true);
    });

    it('validates webhook with partial results', () => {
      const result = enrichmentWebhookSchema.safeParse({
        job_id: 'ext-job-123',
        status: 'completed',
        results: [
          {
            email: 'test@example.com',
            confidence_score: 0.8,
          },
          {
            error: 'Could not find person',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = enrichmentWebhookSchema.safeParse({
        job_id: 'ext-job-123',
        status: 'pending',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Enrichment Field Mapping', () => {
  describe('mapEnrichmentToPerson', () => {
    it('maps enrichment fields to person updates', () => {
      const enrichment: EnrichmentPerson = {
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        full_name: 'John Doe',
        job_title: 'CEO',
        company_name: 'Acme Corp',
        company_domain: 'acme.com',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        phone: '+1234567890',
        location: {
          city: 'New York',
          state: 'NY',
          country: 'USA',
        },
        work_email: null, // Set to null to avoid override
        personal_email: 'john.personal@example.com',
        mobile_phone: null,
        work_phone: null,
        confidence_score: 0.95,
      };

      const person = {
        email: null,
        job_title: null,
        linkedin_url: null,
        phone: null,
        address_city: null,
        address_state: null,
        address_country: null,
      };

      const updates = mapEnrichmentToPerson(enrichment, person);

      // Maps email
      expect(updates.email).toBe('john@example.com');
      // Maps job_title
      expect(updates.job_title).toBe('CEO');
      // Maps linkedin_url
      expect(updates.linkedin_url).toBe('https://linkedin.com/in/johndoe');
      // Maps phone
      expect(updates.phone).toBe('+1234567890');
      // Maps location fields
      expect(updates.address_city).toBe('New York');
      expect(updates.address_state).toBe('NY');
      expect(updates.address_country).toBe('USA');
    });

    it('uses work_email as fallback when email is not set', () => {
      const enrichment: EnrichmentPerson = {
        email: null,
        first_name: null,
        last_name: null,
        full_name: null,
        job_title: null,
        company_name: null,
        company_domain: null,
        linkedin_url: null,
        phone: null,
        location: null,
        work_email: 'work@example.com',
        personal_email: null,
        mobile_phone: null,
        work_phone: null,
        confidence_score: null,
      };

      const person = { email: null };

      const updates = mapEnrichmentToPerson(enrichment, person);
      expect(updates.email).toBe('work@example.com');
    });

    it('uses mobile_phone as fallback when phone is not set', () => {
      const enrichment: EnrichmentPerson = {
        email: null,
        first_name: null,
        last_name: null,
        full_name: null,
        job_title: null,
        company_name: null,
        company_domain: null,
        linkedin_url: null,
        phone: null,
        location: null,
        work_email: null,
        personal_email: null,
        mobile_phone: '+1234567890',
        work_phone: null,
        confidence_score: null,
      };

      const person = { phone: null };

      const updates = mapEnrichmentToPerson(enrichment, person);
      expect(updates.phone).toBe('+1234567890');
    });

    it('does not overwrite existing person values', () => {
      const enrichment: EnrichmentPerson = {
        email: 'new@example.com',
        first_name: null,
        last_name: null,
        full_name: null,
        job_title: 'Developer',
        company_name: null,
        company_domain: null,
        linkedin_url: 'https://linkedin.com/in/test',
        phone: null,
        location: null,
        work_email: null,
        personal_email: null,
        mobile_phone: null,
        work_phone: null,
        confidence_score: null,
      };

      const person = {
        email: 'existing@example.com',
        job_title: null,
        linkedin_url: 'https://linkedin.com/in/existing',
      };

      const updates = mapEnrichmentToPerson(enrichment, person);

      // Should not include fields that already have values
      expect(updates.email).toBeUndefined();
      expect(updates.linkedin_url).toBeUndefined();

      // Should include fields that were null
      expect(updates.job_title).toBe('Developer');
    });

    it('returns empty object when no updates are needed', () => {
      const enrichment: EnrichmentPerson = {
        email: null,
        first_name: null,
        last_name: null,
        full_name: null,
        job_title: null,
        company_name: null,
        company_domain: null,
        linkedin_url: null,
        phone: null,
        location: null,
        work_email: null,
        personal_email: null,
        mobile_phone: null,
        work_phone: null,
        confidence_score: null,
      };

      const person = {
        email: 'existing@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      const updates = mapEnrichmentToPerson(enrichment, person);
      expect(Object.keys(updates)).toHaveLength(0);
    });

    it('handles empty strings in enrichment as non-updates', () => {
      const enrichment: EnrichmentPerson = {
        email: '',
        first_name: null,
        last_name: null,
        full_name: null,
        job_title: '',
        company_name: null,
        company_domain: null,
        linkedin_url: 'https://linkedin.com/in/test',
        phone: null,
        location: null,
        work_email: null,
        personal_email: null,
        mobile_phone: null,
        work_phone: null,
        confidence_score: null,
      };

      const person = {
        email: null,
        job_title: null,
        linkedin_url: null,
      };

      const updates = mapEnrichmentToPerson(enrichment, person);

      // Empty strings are falsy so should not be applied
      expect(updates.email).toBeUndefined();
      expect(updates.job_title).toBeUndefined();

      // Non-empty should be applied
      expect(updates.linkedin_url).toBe('https://linkedin.com/in/test');
    });
  });
});

describe('Enrichment Types', () => {
  it('EnrichmentPerson has all expected fields', () => {
    const enrichment: EnrichmentPerson = {
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      full_name: 'Test User',
      job_title: 'Developer',
      company_name: 'Test Corp',
      company_domain: 'testcorp.com',
      linkedin_url: 'https://linkedin.com/in/testuser',
      phone: '+1234567890',
      location: {
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
      },
      work_email: 'test@testcorp.com',
      personal_email: 'test.personal@example.com',
      mobile_phone: '+0987654321',
      work_phone: '+1111111111',
      confidence_score: 0.9,
    };

    // Type check - all fields should be defined
    expect(enrichment.email).toBeDefined();
    expect(enrichment.first_name).toBeDefined();
    expect(enrichment.last_name).toBeDefined();
    expect(enrichment.full_name).toBeDefined();
    expect(enrichment.job_title).toBeDefined();
    expect(enrichment.company_name).toBeDefined();
    expect(enrichment.company_domain).toBeDefined();
    expect(enrichment.linkedin_url).toBeDefined();
    expect(enrichment.phone).toBeDefined();
    expect(enrichment.location).toBeDefined();
    expect(enrichment.work_email).toBeDefined();
    expect(enrichment.personal_email).toBeDefined();
    expect(enrichment.mobile_phone).toBeDefined();
    expect(enrichment.work_phone).toBeDefined();
    expect(enrichment.confidence_score).toBeDefined();
  });

  it('EnrichmentPerson allows null for all fields', () => {
    const enrichment: EnrichmentPerson = {
      email: null,
      first_name: null,
      last_name: null,
      full_name: null,
      job_title: null,
      company_name: null,
      company_domain: null,
      linkedin_url: null,
      phone: null,
      location: null,
      work_email: null,
      personal_email: null,
      mobile_phone: null,
      work_phone: null,
      confidence_score: null,
    };

    // All fields can be null
    expect(enrichment.email).toBeNull();
    expect(enrichment.location).toBeNull();
    expect(enrichment.confidence_score).toBeNull();
  });
});
