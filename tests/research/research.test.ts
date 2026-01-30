import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startResearchSchema,
  applyResearchSchema,
  researchHistoryQuerySchema,
} from '@/lib/validators/research';
import {
  organizationResearchSchema,
  personResearchSchema,
  buildJsonSchemaDescription,
} from '@/lib/openrouter/structured-output';
import {
  buildOrganizationResearchPrompt,
  buildPersonResearchPrompt,
  buildCustomFieldsSchema,
  formatCustomFieldsForPrompt,
} from '@/lib/openrouter/prompts';
import {
  createFieldMappings,
  getNestedValue,
  ORGANIZATION_FIELD_MAPPINGS,
  PERSON_FIELD_MAPPINGS,
} from '@/types/research';
import type { CustomFieldDefinition } from '@/types/custom-field';
import type { OrganizationResearch, PersonResearch } from '@/lib/openrouter/structured-output';

describe('Research Validators', () => {
  describe('startResearchSchema', () => {
    it('validates a valid organization research request', () => {
      const result = startResearchSchema.safeParse({
        entity_type: 'organization',
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
        include_custom_fields: true,
      });
      expect(result.success).toBe(true);
    });

    it('validates a valid person research request', () => {
      const result = startResearchSchema.safeParse({
        entity_type: 'person',
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid entity types', () => {
      const result = startResearchSchema.safeParse({
        entity_type: 'project',
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid UUIDs', () => {
      const result = startResearchSchema.safeParse({
        entity_type: 'organization',
        entity_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('applyResearchSchema', () => {
    it('validates a valid apply request', () => {
      const result = applyResearchSchema.safeParse({
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        field_updates: [
          { field_name: 'website', is_custom: false, value: 'https://example.com' },
          { field_name: 'industry', is_custom: false, value: 'Technology' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('allows empty field updates', () => {
      const result = applyResearchSchema.safeParse({
        job_id: '550e8400-e29b-41d4-a716-446655440000',
        field_updates: [],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid job_id', () => {
      const result = applyResearchSchema.safeParse({
        job_id: 'invalid',
        field_updates: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('researchHistoryQuerySchema', () => {
    it('validates with all parameters', () => {
      const result = researchHistoryQuerySchema.safeParse({
        entity_type: 'organization',
        entity_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'completed',
        limit: 20,
        offset: 10,
      });
      expect(result.success).toBe(true);
    });

    it('validates with no parameters', () => {
      const result = researchHistoryQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('coerces limit to number', () => {
      const result = researchHistoryQuerySchema.safeParse({
        limit: '50',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('rejects limit over 100', () => {
      const result = researchHistoryQuerySchema.safeParse({
        limit: 150,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Research Schemas', () => {
  describe('organizationResearchSchema', () => {
    it('validates complete organization research', () => {
      const data: OrganizationResearch = {
        company_name: 'Acme Corp',
        website: 'https://acme.com',
        industry: 'Technology',
        employee_count: 500,
        annual_revenue: '$10M - $50M',
        description: 'A technology company',
        headquarters: {
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
        },
        founded_year: 2010,
        key_products: ['Product A', 'Product B'],
        competitors: ['Competitor 1'],
        recent_news: [
          { title: 'News', date: '2024-01-01', summary: 'Summary' },
        ],
        custom_fields: { industry_code: 'TECH001' },
        confidence_scores: { company_name: 0.95 },
      };
      const result = organizationResearchSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates with all null values', () => {
      const data: OrganizationResearch = {
        company_name: null,
        website: null,
        industry: null,
        employee_count: null,
        annual_revenue: null,
        description: null,
        headquarters: null,
        founded_year: null,
        key_products: null,
        competitors: null,
        recent_news: null,
      };
      const result = organizationResearchSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('personResearchSchema', () => {
    it('validates complete person research', () => {
      const data: PersonResearch = {
        full_name: 'John Doe',
        current_title: 'CEO',
        current_company: 'Acme Corp',
        email: 'john@acme.com',
        phone: '+1-555-123-4567',
        linkedin_url: 'https://linkedin.com/in/johndoe',
        location: {
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
        },
        education: [
          { institution: 'Stanford', degree: 'MBA', year: 2005 },
        ],
        work_history: [
          { company: 'Acme', title: 'CEO', start_year: 2015, end_year: null },
        ],
        skills: ['Leadership', 'Strategy'],
        bio: 'Experienced executive',
        custom_fields: { department: 'Executive' },
        confidence_scores: { full_name: 0.99 },
      };
      const result = personResearchSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('buildJsonSchemaDescription', () => {
    it('returns organization research schema', () => {
      const schema = buildJsonSchemaDescription('organizationResearch');
      const parsed = JSON.parse(schema);
      expect(parsed.type).toBe('object');
      expect(parsed.properties.company_name).toBeDefined();
    });

    it('returns person research schema', () => {
      const schema = buildJsonSchemaDescription('personResearch');
      const parsed = JSON.parse(schema);
      expect(parsed.type).toBe('object');
      expect(parsed.properties.full_name).toBeDefined();
    });

    it('returns empty object for unknown schema', () => {
      const schema = buildJsonSchemaDescription('unknown');
      expect(schema).toBe('{}');
    });
  });
});

describe('Prompt Builders', () => {
  describe('buildOrganizationResearchPrompt', () => {
    it('builds prompt with basic organization info', () => {
      const prompt = buildOrganizationResearchPrompt({
        name: 'Acme Corp',
        domain: 'acme.com',
        website: 'https://acme.com',
        industry: 'Technology',
      });

      expect(prompt).toContain('Acme Corp');
      expect(prompt).toContain('acme.com');
      expect(prompt).toContain('https://acme.com');
      expect(prompt).toContain('Technology');
      expect(prompt).toContain('business intelligence researcher');
    });

    it('builds prompt with custom fields', () => {
      const customFields: CustomFieldDefinition[] = [
        {
          id: '1',
          project_id: 'p1',
          name: 'contract_value',
          label: 'Contract Value',
          description: 'Total contract value',
          entity_type: 'organization',
          field_type: 'currency',
          is_required: false,
          is_unique: false,
          is_searchable: false,
          is_filterable: false,
          is_visible_in_list: true,
          display_order: 0,
          group_name: null,
          options: [],
          default_value: null,
          validation_rules: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          deleted_at: null,
        },
      ];

      const prompt = buildOrganizationResearchPrompt(
        { name: 'Test Corp', domain: null, website: null, industry: null },
        customFields
      );

      expect(prompt).toContain('Contract Value');
      expect(prompt).toContain('contract_value');
      expect(prompt).toContain('monetary amount');
    });

    it('handles null values in organization', () => {
      const prompt = buildOrganizationResearchPrompt({
        name: 'Test Corp',
        domain: null,
        website: null,
        industry: null,
      });

      expect(prompt).toContain('Test Corp');
      expect(prompt).not.toContain('Domain:');
    });
  });

  describe('buildPersonResearchPrompt', () => {
    it('builds prompt with person and organization', () => {
      const prompt = buildPersonResearchPrompt(
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          job_title: 'CEO',
        },
        'Acme Corp'
      );

      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('john@example.com');
      expect(prompt).toContain('CEO');
      expect(prompt).toContain('Acme Corp');
      expect(prompt).toContain('professional research analyst');
    });

    it('builds prompt without organization', () => {
      const prompt = buildPersonResearchPrompt({
        first_name: 'Jane',
        last_name: 'Smith',
        email: null,
        job_title: null,
      });

      expect(prompt).toContain('Jane Smith');
      expect(prompt).not.toContain('Company:');
    });
  });

  describe('buildCustomFieldsSchema', () => {
    it('builds schema for text field', () => {
      const fields: CustomFieldDefinition[] = [
        createMockField({ name: 'notes', field_type: 'text' }),
      ];
      const schema = buildCustomFieldsSchema(fields);
      expect(schema.properties).toHaveProperty('notes');
    });

    it('builds schema for select field with options', () => {
      const fields: CustomFieldDefinition[] = [
        createMockField({
          name: 'status',
          field_type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        }),
      ];
      const schema = buildCustomFieldsSchema(fields);
      const statusProp = (schema.properties as Record<string, { enum?: string[] }>).status;
      expect(statusProp.enum).toContain('active');
      expect(statusProp.enum).toContain('inactive');
    });

    it('builds schema for number field', () => {
      const fields: CustomFieldDefinition[] = [
        createMockField({ name: 'count', field_type: 'number' }),
      ];
      const schema = buildCustomFieldsSchema(fields);
      const countProp = (schema.properties as Record<string, { type: string[] }>).count;
      expect(countProp.type).toContain('number');
    });
  });

  describe('formatCustomFieldsForPrompt', () => {
    it('formats fields with descriptions', () => {
      const fields: CustomFieldDefinition[] = [
        createMockField({
          name: 'industry_code',
          label: 'Industry Code',
          description: 'NAICS code for the industry',
          field_type: 'text',
        }),
      ];
      const formatted = formatCustomFieldsForPrompt(fields);
      expect(formatted).toContain('Industry Code');
      expect(formatted).toContain('industry_code');
      expect(formatted).toContain('NAICS code');
    });

    it('returns empty string for no fields', () => {
      const formatted = formatCustomFieldsForPrompt([]);
      expect(formatted).toBe('');
    });
  });
});

describe('Field Mapping Utilities', () => {
  describe('getNestedValue', () => {
    it('gets top-level value', () => {
      const obj = { name: 'Test' };
      expect(getNestedValue(obj, 'name')).toBe('Test');
    });

    it('gets nested value', () => {
      const obj = { headquarters: { city: 'San Francisco' } };
      expect(getNestedValue(obj, 'headquarters.city')).toBe('San Francisco');
    });

    it('returns undefined for missing path', () => {
      const obj = { name: 'Test' };
      expect(getNestedValue(obj, 'missing.path')).toBeUndefined();
    });

    it('handles null object', () => {
      expect(getNestedValue(null, 'name')).toBeUndefined();
    });
  });

  describe('createFieldMappings', () => {
    it('creates mappings for organization research', () => {
      const result: OrganizationResearch = {
        company_name: 'Acme Corp',
        website: 'https://acme.com',
        industry: 'Technology',
        employee_count: 500,
        annual_revenue: null,
        description: 'A company',
        headquarters: { city: 'SF', state: 'CA', country: 'USA' },
        founded_year: 2010,
        key_products: null,
        competitors: null,
        recent_news: null,
        confidence_scores: { company_name: 0.95, website: 0.8 },
      };

      const currentEntity = { name: 'Old Name', website: null };
      const mappings = createFieldMappings(result, 'organization', currentEntity);

      expect(mappings.length).toBeGreaterThan(0);

      const nameMappimg = mappings.find(m => m.target_field === 'name');
      expect(nameMappimg?.value).toBe('Acme Corp');
      expect(nameMappimg?.current_value).toBe('Old Name');

      const websiteMapping = mappings.find(m => m.target_field === 'website');
      expect(websiteMapping?.value).toBe('https://acme.com');
      expect(websiteMapping?.should_update).toBe(true);
    });

    it('creates mappings for person research', () => {
      const result: PersonResearch = {
        full_name: 'John Doe',
        current_title: 'CEO',
        current_company: 'Acme',
        email: 'john@acme.com',
        phone: null,
        linkedin_url: 'https://linkedin.com/in/john',
        location: { city: 'SF', state: 'CA', country: 'USA' },
        education: null,
        work_history: null,
        skills: null,
        bio: 'Executive bio',
        confidence_scores: { current_title: 0.9 },
      };

      const currentEntity = { job_title: null, email: 'old@email.com' };
      const mappings = createFieldMappings(result, 'person', currentEntity);

      const titleMapping = mappings.find(m => m.target_field === 'job_title');
      expect(titleMapping?.value).toBe('CEO');
      expect(titleMapping?.should_update).toBe(true);

      const emailMapping = mappings.find(m => m.target_field === 'email');
      expect(emailMapping?.should_update).toBe(false); // Already has value
    });

    it('includes custom field mappings', () => {
      const result: OrganizationResearch = {
        company_name: null,
        website: null,
        industry: null,
        employee_count: null,
        annual_revenue: null,
        description: null,
        headquarters: null,
        founded_year: null,
        key_products: null,
        competitors: null,
        recent_news: null,
        custom_fields: {
          contract_value: 50000,
          region: 'West',
        },
        confidence_scores: { custom_contract_value: 0.7 },
      };

      const currentEntity = { custom_fields: { contract_value: null } };
      const customFieldNames = ['contract_value', 'region'];
      const mappings = createFieldMappings(result, 'organization', currentEntity, customFieldNames);

      const customMappings = mappings.filter(m => m.target_is_custom);
      expect(customMappings.length).toBe(2);

      const contractMapping = customMappings.find(m => m.target_field === 'contract_value');
      expect(contractMapping?.value).toBe(50000);
    });
  });

  describe('ORGANIZATION_FIELD_MAPPINGS', () => {
    it('maps standard organization fields', () => {
      expect(ORGANIZATION_FIELD_MAPPINGS.company_name).toBe('name');
      expect(ORGANIZATION_FIELD_MAPPINGS.website).toBe('website');
      expect(ORGANIZATION_FIELD_MAPPINGS['headquarters.city']).toBe('address_city');
    });
  });

  describe('PERSON_FIELD_MAPPINGS', () => {
    it('maps standard person fields', () => {
      expect(PERSON_FIELD_MAPPINGS.current_title).toBe('job_title');
      expect(PERSON_FIELD_MAPPINGS.linkedin_url).toBe('linkedin_url');
      expect(PERSON_FIELD_MAPPINGS.full_name).toBe('__skip__');
    });
  });
});

// Helper function to create mock field definitions
function createMockField(overrides: Partial<CustomFieldDefinition>): CustomFieldDefinition {
  return {
    id: '1',
    project_id: 'p1',
    name: 'field_name',
    label: 'Field Label',
    description: null,
    entity_type: 'organization',
    field_type: 'text',
    is_required: false,
    is_unique: false,
    is_searchable: false,
    is_filterable: false,
    is_visible_in_list: true,
    display_order: 0,
    group_name: null,
    options: [],
    default_value: null,
    validation_rules: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    deleted_at: null,
    ...overrides,
  };
}
