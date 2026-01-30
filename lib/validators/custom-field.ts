import { z } from 'zod';

// Field types enum
const fieldTypes = [
  'text',
  'textarea',
  'number',
  'currency',
  'percentage',
  'date',
  'datetime',
  'boolean',
  'select',
  'multi_select',
  'url',
  'email',
  'phone',
  'rating',
  'user',
] as const;

// Entity types enum
const entityTypes = ['organization', 'person', 'opportunity', 'rfp'] as const;

// Select option schema
const selectOptionSchema = z.object({
  value: z.string().min(1, 'Option value is required'),
  label: z.string().min(1, 'Option label is required'),
  color: z.string().optional(),
});

// Validation rules schema
const validationRulesSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
}).optional();

// Field name validation - must be snake_case and not conflict with system fields
const fieldNameSchema = z
  .string()
  .min(1, 'Field name is required')
  .max(50, 'Field name must be 50 characters or less')
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Field name must be lowercase with underscores (snake_case)'
  )
  .refine(
    (name) => !RESERVED_FIELD_NAMES.includes(name),
    'This field name is reserved and cannot be used'
  );

// Reserved field names (system columns that exist in the database)
const RESERVED_FIELD_NAMES = [
  'id',
  'project_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'custom_fields',
  // Organization fields
  'name',
  'domain',
  'website',
  'industry',
  'employee_count',
  'annual_revenue',
  'description',
  'logo_url',
  'linkedin_url',
  'address_street',
  'address_city',
  'address_state',
  'address_postal_code',
  'address_country',
  'phone',
  // Person fields
  'first_name',
  'last_name',
  'email',
  'mobile_phone',
  'job_title',
  'department',
  'twitter_handle',
  'avatar_url',
  'timezone',
  'preferred_contact_method',
  'notes',
  'enrichment_status',
  'enriched_at',
  'enrichment_data',
  // Opportunity fields
  'stage',
  'amount',
  'currency',
  'probability',
  'expected_close_date',
  'actual_close_date',
  'organization_id',
  'primary_contact_id',
  'owner_id',
  'stage_changed_at',
  'days_in_stage',
  'lost_reason',
  'won_reason',
  'competitor',
  'source',
  'campaign',
  // RFP fields
  'title',
  'status',
  'rfp_number',
  'opportunity_id',
  'issue_date',
  'due_date',
  'questions_due_date',
  'decision_date',
  'estimated_value',
  'budget_range',
  'submission_method',
  'submission_portal_url',
  'submission_email',
  'submission_instructions',
  'win_probability',
  'go_no_go_decision',
  'go_no_go_date',
  'go_no_go_notes',
  'outcome_reason',
  'feedback',
  'awarded_to',
  'rfp_document_url',
  'response_document_url',
];

// Base schema for creating a custom field definition
export const customFieldDefinitionSchema = z.object({
  name: fieldNameSchema,
  label: z.string().min(1, 'Label is required').max(100, 'Label must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').nullable(),
  entity_type: z.enum(entityTypes),
  field_type: z.enum(fieldTypes),
  is_required: z.boolean(),
  is_unique: z.boolean(),
  is_searchable: z.boolean(),
  is_filterable: z.boolean(),
  is_visible_in_list: z.boolean(),
  display_order: z.number().int().min(0),
  group_name: z.string().max(100).nullable(),
  options: z.array(selectOptionSchema),
  default_value: z.any().nullable(),
  validation_rules: validationRulesSchema,
  // AI extraction settings
  is_ai_extractable: z.boolean().optional(),
  ai_extraction_hint: z.string().max(1000).nullable().optional(),
  ai_confidence_threshold: z.number().min(0).max(1).nullable().optional(),
}).superRefine((data, ctx) => {
  // Validate options are required for select/multi_select
  if (
    (data.field_type === 'select' || data.field_type === 'multi_select') &&
    (!data.options || data.options.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one option is required for select fields',
      path: ['options'],
    });
  }

  // Validate unique option values
  if (data.options && data.options.length > 0) {
    const values = data.options.map((o) => o.value);
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Option values must be unique',
        path: ['options'],
      });
    }
  }

  // Validate validation rules match field type
  if (data.validation_rules) {
    const { minLength, maxLength, min, max } = data.validation_rules;
    const textTypes = ['text', 'textarea', 'url', 'email', 'phone'];
    const numberTypes = ['number', 'currency', 'percentage', 'rating'];

    if (
      (minLength !== undefined || maxLength !== undefined) &&
      !textTypes.includes(data.field_type)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minLength/maxLength can only be used with text field types',
        path: ['validation_rules'],
      });
    }

    if (
      (min !== undefined || max !== undefined) &&
      !numberTypes.includes(data.field_type)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'min/max can only be used with number field types',
        path: ['validation_rules'],
      });
    }
  }
});

// Schema for creating a new field
export const createCustomFieldDefinitionSchema = customFieldDefinitionSchema;

// Schema for updating an existing field
export const updateCustomFieldDefinitionSchema = z.object({
  label: z.string().min(1, 'Label is required').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  is_required: z.boolean().optional(),
  is_unique: z.boolean().optional(),
  is_searchable: z.boolean().optional(),
  is_filterable: z.boolean().optional(),
  is_visible_in_list: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  group_name: z.string().max(100).nullable().optional(),
  options: z.array(selectOptionSchema).optional(),
  default_value: z.any().nullable().optional(),
  validation_rules: validationRulesSchema,
  // AI extraction settings
  is_ai_extractable: z.boolean().optional(),
  ai_extraction_hint: z.string().max(1000).nullable().optional(),
  ai_confidence_threshold: z.number().min(0).max(1).nullable().optional(),
});

// Schema for reordering fields
export const reorderFieldsSchema = z.object({
  field_orders: z.array(
    z.object({
      id: z.string().uuid(),
      display_order: z.number().int().min(0),
    })
  ),
});

// Type exports
export type CreateCustomFieldDefinitionInput = z.infer<typeof createCustomFieldDefinitionSchema>;
export type UpdateCustomFieldDefinitionInput = z.infer<typeof updateCustomFieldDefinitionSchema>;
export type ReorderFieldsInput = z.infer<typeof reorderFieldsSchema>;
export type SelectOption = z.infer<typeof selectOptionSchema>;
export type ValidationRules = z.infer<typeof validationRulesSchema>;

// Export reserved field names for use elsewhere
export { RESERVED_FIELD_NAMES };
