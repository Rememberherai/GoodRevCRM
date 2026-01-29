import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  customFieldDefinitionSchema,
  createCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  reorderFieldsSchema,
  RESERVED_FIELD_NAMES,
} from '@/lib/validators/custom-field';

describe('Custom Field Validators', () => {
  describe('customFieldDefinitionSchema', () => {
    it('validates a valid text field', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'custom_text',
        label: 'Custom Text',
        description: 'A custom text field',
        entity_type: 'organization',
        field_type: 'text',
        is_required: false,
        is_unique: false,
        is_searchable: true,
        is_filterable: false,
        is_visible_in_list: true,
        display_order: 0,
        group_name: null,
        options: [],
        default_value: null,
      });
      expect(result.success).toBe(true);
    });

    it('validates a valid select field with options', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'status_type',
        label: 'Status Type',
        description: null,
        entity_type: 'opportunity',
        field_type: 'select',
        is_required: true,
        is_unique: false,
        is_searchable: false,
        is_filterable: true,
        is_visible_in_list: true,
        display_order: 1,
        group_name: 'Status',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        default_value: null,
      });
      expect(result.success).toBe(true);
    });

    it('requires name', () => {
      const result = customFieldDefinitionSchema.safeParse({
        label: 'Test',
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
      });
      expect(result.success).toBe(false);
    });

    it('requires label', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'test_field',
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
      });
      expect(result.success).toBe(false);
    });

    it('validates name is snake_case', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'InvalidName',
        label: 'Test',
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
      });
      expect(result.success).toBe(false);
    });

    it('validates name starts with letter', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: '1_invalid',
        label: 'Test',
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
      });
      expect(result.success).toBe(false);
    });

    it('rejects reserved field names', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'id',
        label: 'ID Field',
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
      });
      expect(result.success).toBe(false);
    });

    it('requires options for select field', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'select_field',
        label: 'Select',
        description: null,
        entity_type: 'organization',
        field_type: 'select',
        is_required: false,
        is_unique: false,
        is_searchable: false,
        is_filterable: false,
        is_visible_in_list: true,
        display_order: 0,
        group_name: null,
        options: [],
        default_value: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('option'))).toBe(true);
      }
    });

    it('requires options for multi_select field', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'multi_select_field',
        label: 'Multi Select',
        description: null,
        entity_type: 'organization',
        field_type: 'multi_select',
        is_required: false,
        is_unique: false,
        is_searchable: false,
        is_filterable: false,
        is_visible_in_list: true,
        display_order: 0,
        group_name: null,
        options: [],
        default_value: null,
      });
      expect(result.success).toBe(false);
    });

    it('validates option values are unique', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'select_field',
        label: 'Select',
        description: null,
        entity_type: 'organization',
        field_type: 'select',
        is_required: false,
        is_unique: false,
        is_searchable: false,
        is_filterable: false,
        is_visible_in_list: true,
        display_order: 0,
        group_name: null,
        options: [
          { value: 'same', label: 'Option 1' },
          { value: 'same', label: 'Option 2' },
        ],
        default_value: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('unique'))).toBe(true);
      }
    });

    it('validates entity_type enum', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'test_field',
        label: 'Test',
        description: null,
        entity_type: 'invalid_type',
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
      });
      expect(result.success).toBe(false);
    });

    it('validates field_type enum', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'test_field',
        label: 'Test',
        description: null,
        entity_type: 'organization',
        field_type: 'invalid_type',
        is_required: false,
        is_unique: false,
        is_searchable: false,
        is_filterable: false,
        is_visible_in_list: true,
        display_order: 0,
        group_name: null,
        options: [],
        default_value: null,
      });
      expect(result.success).toBe(false);
    });

    it('allows all valid entity types', () => {
      const entityTypes = ['organization', 'person', 'opportunity', 'rfp'];

      entityTypes.forEach((entityType) => {
        const result = customFieldDefinitionSchema.safeParse({
          name: 'test_field',
          label: 'Test',
          description: null,
          entity_type: entityType,
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
        });
        expect(result.success).toBe(true);
      });
    });

    it('allows all valid field types', () => {
      const fieldTypes = [
        'text', 'textarea', 'number', 'currency', 'percentage',
        'date', 'datetime', 'boolean', 'url', 'email', 'phone', 'rating', 'user',
      ];

      fieldTypes.forEach((fieldType) => {
        const result = customFieldDefinitionSchema.safeParse({
          name: 'test_field',
          label: 'Test',
          description: null,
          entity_type: 'organization',
          field_type: fieldType,
          is_required: false,
          is_unique: false,
          is_searchable: false,
          is_filterable: false,
          is_visible_in_list: true,
          display_order: 0,
          group_name: null,
          options: [],
          default_value: null,
        });
        expect(result.success).toBe(true);
      });
    });

    it('validates max length for name', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'a'.repeat(51),
        label: 'Test',
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
      });
      expect(result.success).toBe(false);
    });

    it('validates max length for label', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'test_field',
        label: 'a'.repeat(101),
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
      });
      expect(result.success).toBe(false);
    });

    it('validates max length for description', () => {
      const result = customFieldDefinitionSchema.safeParse({
        name: 'test_field',
        label: 'Test',
        description: 'a'.repeat(501),
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
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createCustomFieldDefinitionSchema', () => {
    it('is the same as customFieldDefinitionSchema', () => {
      const input = {
        name: 'test_field',
        label: 'Test',
        description: null,
        entity_type: 'organization' as const,
        field_type: 'text' as const,
        is_required: false,
        is_unique: false,
        is_searchable: false,
        is_filterable: false,
        is_visible_in_list: true,
        display_order: 0,
        group_name: null,
        options: [],
        default_value: null,
      };
      const createResult = createCustomFieldDefinitionSchema.safeParse(input);
      const baseResult = customFieldDefinitionSchema.safeParse(input);
      expect(createResult.success).toBe(baseResult.success);
    });
  });

  describe('updateCustomFieldDefinitionSchema', () => {
    it('allows partial updates', () => {
      const result = updateCustomFieldDefinitionSchema.safeParse({
        label: 'Updated Label',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only description', () => {
      const result = updateCustomFieldDefinitionSchema.safeParse({
        description: 'Updated description',
      });
      expect(result.success).toBe(true);
    });

    it('allows updating only settings', () => {
      const result = updateCustomFieldDefinitionSchema.safeParse({
        is_required: true,
        is_searchable: true,
      });
      expect(result.success).toBe(true);
    });

    it('allows updating options', () => {
      const result = updateCustomFieldDefinitionSchema.safeParse({
        options: [
          { value: 'new_option', label: 'New Option' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('allows empty update', () => {
      const result = updateCustomFieldDefinitionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('still validates field constraints on update', () => {
      const result = updateCustomFieldDefinitionSchema.safeParse({
        label: '', // Invalid: empty
      });
      expect(result.success).toBe(false);
    });
  });

  describe('reorderFieldsSchema', () => {
    it('validates valid reorder request', () => {
      const result = reorderFieldsSchema.safeParse({
        field_orders: [
          { id: '550e8400-e29b-41d4-a716-446655440000', display_order: 0 },
          { id: '550e8400-e29b-41d4-a716-446655440001', display_order: 1 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('validates id is UUID', () => {
      const result = reorderFieldsSchema.safeParse({
        field_orders: [
          { id: 'not-a-uuid', display_order: 0 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('validates display_order is non-negative', () => {
      const result = reorderFieldsSchema.safeParse({
        field_orders: [
          { id: '550e8400-e29b-41d4-a716-446655440000', display_order: -1 },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('allows empty field_orders', () => {
      const result = reorderFieldsSchema.safeParse({
        field_orders: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RESERVED_FIELD_NAMES', () => {
    it('includes common system fields', () => {
      expect(RESERVED_FIELD_NAMES).toContain('id');
      expect(RESERVED_FIELD_NAMES).toContain('project_id');
      expect(RESERVED_FIELD_NAMES).toContain('created_at');
      expect(RESERVED_FIELD_NAMES).toContain('updated_at');
      expect(RESERVED_FIELD_NAMES).toContain('deleted_at');
      expect(RESERVED_FIELD_NAMES).toContain('custom_fields');
    });

    it('includes organization fields', () => {
      expect(RESERVED_FIELD_NAMES).toContain('name');
      expect(RESERVED_FIELD_NAMES).toContain('domain');
      expect(RESERVED_FIELD_NAMES).toContain('industry');
    });

    it('includes person fields', () => {
      expect(RESERVED_FIELD_NAMES).toContain('first_name');
      expect(RESERVED_FIELD_NAMES).toContain('last_name');
      expect(RESERVED_FIELD_NAMES).toContain('email');
    });

    it('includes opportunity fields', () => {
      expect(RESERVED_FIELD_NAMES).toContain('stage');
      expect(RESERVED_FIELD_NAMES).toContain('amount');
      expect(RESERVED_FIELD_NAMES).toContain('probability');
    });

    it('includes RFP fields', () => {
      expect(RESERVED_FIELD_NAMES).toContain('title');
      expect(RESERVED_FIELD_NAMES).toContain('status');
      expect(RESERVED_FIELD_NAMES).toContain('due_date');
    });
  });
});

describe('Custom Field Store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('has initial state', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const state = useCustomFieldStore.getState();

    expect(state.fields).toEqual([]);
    expect(state.fieldsByEntity).toEqual({
      organization: [],
      person: [],
      opportunity: [],
      rfp: [],
    });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.selectedEntityType).toBe('organization');
  });

  it('sets fields and groups by entity type', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const fields = [
      { id: '1', entity_type: 'organization', name: 'org_field', display_order: 0 },
      { id: '2', entity_type: 'person', name: 'person_field', display_order: 0 },
      { id: '3', entity_type: 'organization', name: 'org_field_2', display_order: 1 },
    ] as any;

    useCustomFieldStore.getState().setFields(fields);

    const state = useCustomFieldStore.getState();
    expect(state.fields).toHaveLength(3);
    expect(state.fieldsByEntity.organization).toHaveLength(2);
    expect(state.fieldsByEntity.person).toHaveLength(1);
    expect(state.fieldsByEntity.opportunity).toHaveLength(0);
    expect(state.fieldsByEntity.rfp).toHaveLength(0);
  });

  it('sorts fields by display_order', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const fields = [
      { id: '1', entity_type: 'organization', name: 'field_c', display_order: 2 },
      { id: '2', entity_type: 'organization', name: 'field_a', display_order: 0 },
      { id: '3', entity_type: 'organization', name: 'field_b', display_order: 1 },
    ] as any;

    useCustomFieldStore.getState().setFields(fields);

    const state = useCustomFieldStore.getState();
    expect(state.fieldsByEntity.organization[0]?.name).toBe('field_a');
    expect(state.fieldsByEntity.organization[1]?.name).toBe('field_b');
    expect(state.fieldsByEntity.organization[2]?.name).toBe('field_c');
  });

  it('adds field', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const field = { id: '1', entity_type: 'organization', name: 'new_field', display_order: 0 } as any;

    useCustomFieldStore.getState().addField(field);

    const state = useCustomFieldStore.getState();
    expect(state.fields).toContainEqual(field);
    expect(state.fieldsByEntity.organization).toContainEqual(field);
  });

  it('updates field', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const field = { id: '1', entity_type: 'organization', name: 'field', label: 'Old', display_order: 0 } as any;
    useCustomFieldStore.getState().addField(field);

    useCustomFieldStore.getState().updateField('1', { label: 'New' });

    const state = useCustomFieldStore.getState();
    expect(state.fields[0]?.label).toBe('New');
  });

  it('removes field', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const field = { id: '1', entity_type: 'organization', name: 'field', display_order: 0 } as any;
    useCustomFieldStore.getState().addField(field);

    useCustomFieldStore.getState().removeField('1');

    const state = useCustomFieldStore.getState();
    expect(state.fields).toHaveLength(0);
    expect(state.fieldsByEntity.organization).toHaveLength(0);
  });

  it('sets loading state', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');

    useCustomFieldStore.getState().setLoading(true);
    expect(useCustomFieldStore.getState().isLoading).toBe(true);

    useCustomFieldStore.getState().setLoading(false);
    expect(useCustomFieldStore.getState().isLoading).toBe(false);
  });

  it('sets error state', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');

    useCustomFieldStore.getState().setError('Something went wrong');

    const state = useCustomFieldStore.getState();
    expect(state.error).toBe('Something went wrong');
    expect(state.isLoading).toBe(false);
  });

  it('sets selected entity type', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');

    useCustomFieldStore.getState().setSelectedEntityType('person');

    const state = useCustomFieldStore.getState();
    expect(state.selectedEntityType).toBe('person');
  });

  it('gets fields for entity', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const fields = [
      { id: '1', entity_type: 'organization', name: 'org_field', display_order: 0 },
      { id: '2', entity_type: 'person', name: 'person_field', display_order: 0 },
    ] as any;
    useCustomFieldStore.getState().setFields(fields);

    const orgFields = useCustomFieldStore.getState().getFieldsForEntity('organization');
    const personFields = useCustomFieldStore.getState().getFieldsForEntity('person');

    expect(orgFields).toHaveLength(1);
    expect(personFields).toHaveLength(1);
  });

  it('reorders fields', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const fields = [
      { id: '1', entity_type: 'organization', name: 'field_a', display_order: 0 },
      { id: '2', entity_type: 'organization', name: 'field_b', display_order: 1 },
    ] as any;
    useCustomFieldStore.getState().setFields(fields);

    useCustomFieldStore.getState().reorderFields('organization', [
      { id: '1', display_order: 1 },
      { id: '2', display_order: 0 },
    ]);

    const state = useCustomFieldStore.getState();
    expect(state.fieldsByEntity.organization[0]?.name).toBe('field_b');
    expect(state.fieldsByEntity.organization[1]?.name).toBe('field_a');
  });

  it('resets state', async () => {
    const { useCustomFieldStore } = await import('@/stores/custom-field');
    const field = { id: '1', entity_type: 'organization', name: 'field', display_order: 0 } as any;
    useCustomFieldStore.getState().addField(field);
    useCustomFieldStore.getState().setSelectedEntityType('person');
    useCustomFieldStore.getState().setError('error');

    useCustomFieldStore.getState().reset();

    const state = useCustomFieldStore.getState();
    expect(state.fields).toEqual([]);
    expect(state.selectedEntityType).toBe('organization');
    expect(state.error).toBeNull();
  });
});
