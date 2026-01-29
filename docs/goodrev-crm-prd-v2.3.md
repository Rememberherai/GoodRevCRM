# GoodRev CRM — Product Requirements Document v2.3

**Product Name:** GoodRev CRM  
**Primary Domain:** app.goodrev.com  
**Company:** GoodRev  
**Product Type:** Multi-tenant research CRM with AI-powered outbound  
**Version:** 2.3  
**Last Updated:** January 2026

---

## Changelog from v2.2

| Section | Change |
|---------|--------|
| **NEW: Section 18** | Dashboard |
| **NEW: Section 19** | Tasks & Reminders |
| **NEW: Section 20** | Global Search |
| **NEW: Section 21** | Notes |
| **NEW: Section 22** | Tags & Labels |
| **NEW: Section 23** | Email Templates (One-Off) |
| **NEW: Section 24** | Notifications System |
| **NEW: Section 25** | CSV Import |
| **NEW: Section 26** | Duplicate Detection |
| **ENHANCED: Section 9** | Dynamic Schema System (Full CRUD with destructive delete) |
| **Updated: Section 8** | Navigation updated |
| **Updated: Milestones** | Expanded for new features |

---

## Table of Contents

**Core (from v2.2)**
1. Executive Summary
2. Multi-Tenancy Architecture  
3. Database Schema — Core Tables
4. Project Settings Schema
5. OpenRouter Integration
6. FullEnrich Integration
7. Model Selection Settings
8. Navigation (Updated)

**Dynamic Schema (Enhanced)**
9. **Dynamic Schema System — Full CRUD**

**Entities**
10. Organizations Module
11. People Module
12. Opportunities Module
13. RFPs Module

**Outbound**
14. Email Sequences Module
15. AI Email Generation
16. Gmail API Integration
17. Email Activity Tracking

**New in v2.3**
18. **Dashboard**
19. **Tasks & Reminders**
20. **Global Search**
21. **Notes**
22. **Tags & Labels**
23. **Email Templates (One-Off)**
24. **Notifications System**
25. **CSV Import**
26. **Duplicate Detection**

**Meta**
27. Milestones (Updated)
28. Definition of Done (Updated)

---

# Section 9: Dynamic Schema System — Full CRUD (Enhanced)

## 9.1 Overview

Users can extend the schema **without developer intervention**:
- **Create** new fields via GUI → saves definition, data stored in JSONB
- **Read** field definitions and values from JSONB
- **Update** field metadata (name, description, AI hints)
- **Delete** fields with destructive confirmation → removes data from JSONB

**Key Design Decision:** Custom fields are stored in a `custom_fields JSONB` column on each entity table, NOT as separate database columns. This is the industry-standard approach (Salesforce, HubSpot, Pipedrive) for multi-tenant systems.

**Why JSONB?**
- ✅ No column conflicts between projects
- ✅ No DDL (ALTER TABLE) at runtime — faster, safer
- ✅ Each project's fields are completely isolated
- ✅ Easy to add/remove fields instantly
- ✅ Simpler backups and data migration

## 9.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCHEMA MANAGER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Field          │    │  Entity Tables  │    │  AI Research    │         │
│  │  Definitions    │───▶│  custom_fields  │◀───│  Integration    │         │
│  │  (metadata)     │    │  (JSONB column) │    │  (OpenRouter)   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│         │                       │                      │                    │
│         │              { "water_ph": 7.2,              │                    │
│         │                "epa_violations": false }     │                    │
│         ▼                       ▼                      ▼                    │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                         GUI                                      │       │
│  │  • Schema Manager (Settings > Schema)                            │       │
│  │  • Dynamic Forms (auto-render custom fields)                     │       │
│  │  • Research Panel (includes custom fields in AI prompts)         │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.3 Data Isolation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORGANIZATIONS TABLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ id       │ project_id │ name              │ custom_fields                   │
├──────────┼────────────┼───────────────────┼─────────────────────────────────┤
│ uuid-1   │ project-A  │ Portland Water    │ {"water_ph": 7.2,               │
│          │            │                   │  "epa_violations": false}       │
├──────────┼────────────┼───────────────────┼─────────────────────────────────┤
│ uuid-2   │ project-B  │ Acme Corp         │ {"employee_count": 500,         │
│          │            │                   │  "industry": "manufacturing"}   │
├──────────┼────────────┼───────────────────┼─────────────────────────────────┤
│ uuid-3   │ project-A  │ Seattle Utilities │ {"water_ph": 6.8,               │
│          │            │                   │  "epa_violations": true}        │
└──────────┴────────────┴───────────────────┴─────────────────────────────────┘

Project A's fields: water_ph, epa_violations
Project B's fields: employee_count, industry

→ Completely isolated, no conflicts!
```

## 9.4 Database Schema

### Entity Tables (with JSONB column)

All entity tables include a `custom_fields` JSONB column:

```sql
-- Organizations table (same pattern for people, opportunities, rfps)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- System fields (fixed schema, always present)
  name TEXT NOT NULL,
  website TEXT,
  type TEXT,
  jurisdiction TEXT,
  status TEXT DEFAULT 'active',
  owner_id UUID REFERENCES users(id),
  
  -- CUSTOM FIELDS (flexible, project-scoped)
  custom_fields JSONB DEFAULT '{}',
  
  -- Research
  research_summary TEXT,
  research_freshness TIMESTAMPTZ,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- GIN index for querying custom fields efficiently
CREATE INDEX idx_organizations_custom_fields ON organizations USING GIN (custom_fields);

-- Example queries on custom fields:
-- Find orgs where water_ph > 7
SELECT * FROM organizations 
WHERE project_id = 'xxx' 
  AND (custom_fields->>'water_ph')::numeric > 7;

-- Find orgs with epa_violations = true
SELECT * FROM organizations 
WHERE project_id = 'xxx' 
  AND (custom_fields->>'epa_violations')::boolean = true;

-- Find orgs where treatment_method is 'MBR'
SELECT * FROM organizations 
WHERE project_id = 'xxx' 
  AND custom_fields->>'treatment_method' = 'MBR';
```

### Field Definitions Table (Metadata)

```sql
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Field identification
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'person', 'opportunity', 'rfp')),
  field_name TEXT NOT NULL,           -- Key in JSONB: "water_ph"
  display_name TEXT NOT NULL,         -- Human readable: "Water pH Level"
  
  -- Field configuration
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'long_text', 'number', 'currency', 'percentage',
    'date', 'datetime', 'boolean', 'select', 'multi_select',
    'url', 'email', 'phone', 'rating', 'json'
  )),
  description TEXT,                   -- Help text shown in forms
  placeholder TEXT,                   -- Input placeholder
  default_value JSONB,                -- Default when creating records
  
  -- Validation
  is_required BOOLEAN DEFAULT FALSE,  -- Required on new records
  validation_rules JSONB,             -- { min, max, pattern, etc. }
  options JSONB,                      -- For select/multi_select: [{value, label, color}]
  
  -- AI Integration
  is_ai_extractable BOOLEAN DEFAULT TRUE,
  ai_extraction_hint TEXT,            -- Instructions for AI: "Look for EPA compliance mentions"
  ai_confidence_threshold NUMERIC DEFAULT 0.7,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  show_in_list_view BOOLEAN DEFAULT FALSE,
  show_in_card_view BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique per project + entity type
  UNIQUE(project_id, entity_type, field_name)
);

CREATE INDEX idx_custom_fields_project ON custom_field_definitions(project_id);
CREATE INDEX idx_custom_fields_entity ON custom_field_definitions(project_id, entity_type);
```

### Schema Audit Log

```sql
CREATE TABLE schema_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  
  action TEXT NOT NULL CHECK (action IN ('create_field', 'update_field', 'delete_field')),
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  
  -- Change details
  old_definition JSONB,
  new_definition JSONB,
  
  -- For deletes: data impact
  affected_record_count INTEGER,
  data_sample JSONB,                  -- Sample of deleted values (first 10 rows)
  confirmation_text TEXT,             -- What user typed to confirm
  
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 9.5 Supported Field Types

| Type | JSONB Storage | Form Component | AI Output Format |
|------|---------------|----------------|------------------|
| `text` | `string` | Input | `string` |
| `long_text` | `string` | Textarea | `string` |
| `number` | `number` | Number input | `number` |
| `currency` | `number` | Currency input | `number` |
| `percentage` | `number` | Percentage input | `number` (0-100) |
| `date` | `string` | Date picker | `YYYY-MM-DD` |
| `datetime` | `string` | DateTime picker | `ISO 8601` |
| `boolean` | `boolean` | Toggle/Checkbox | `boolean` |
| `select` | `string` | Dropdown | `string` (option value) |
| `multi_select` | `array` | Multi-select | `string[]` |
| `url` | `string` | URL input | `string` |
| `email` | `string` | Email input | `string` |
| `phone` | `string` | Phone input | `string` |
| `rating` | `number` | Star rating (1-5) | `number` (1-5) |
| `json` | `object` | JSON editor | `object` |

## 9.6 Field CRUD Operations

### CREATE Field

Creating a field is simple — just insert a definition row. No DDL needed!

```typescript
// POST /api/projects/[slug]/schema/fields

interface CreateFieldRequest {
  entity_type: 'organization' | 'person' | 'opportunity' | 'rfp';
  field_name: string;        // Validated: snake_case, no reserved words
  display_name: string;
  field_type: FieldType;
  description?: string;
  placeholder?: string;
  default_value?: any;
  is_required?: boolean;
  validation_rules?: ValidationRules;
  options?: SelectOption[];  // For select/multi_select
  is_ai_extractable?: boolean;
  ai_extraction_hint?: string;
  show_in_list_view?: boolean;
}

async function createField(projectId: string, data: CreateFieldRequest) {
  // 1. Validate field_name
  validateFieldName(data.field_name); // snake_case, not reserved, <= 50 chars
  
  // 2. Check for duplicates in this project
  const existing = await supabase
    .from('custom_field_definitions')
    .select('id')
    .eq('project_id', projectId)
    .eq('entity_type', data.entity_type)
    .eq('field_name', data.field_name)
    .single();
  
  if (existing.data) {
    throw new Error(`Field "${data.field_name}" already exists for ${data.entity_type}`);
  }
  
  // 3. Get next display order
  const { data: lastField } = await supabase
    .from('custom_field_definitions')
    .select('display_order')
    .eq('project_id', projectId)
    .eq('entity_type', data.entity_type)
    .order('display_order', { ascending: false })
    .limit(1)
    .single();
  
  const displayOrder = (lastField?.display_order ?? -1) + 1;
  
  // 4. Insert definition (no ALTER TABLE needed!)
  const { data: definition, error } = await supabase
    .from('custom_field_definitions')
    .insert({
      project_id: projectId,
      ...data,
      display_order: displayOrder,
      created_by: getCurrentUserId()
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // 5. Log action
  await supabase.from('schema_audit_log').insert({
    project_id: projectId,
    action: 'create_field',
    entity_type: data.entity_type,
    field_name: data.field_name,
    new_definition: definition,
    performed_by: getCurrentUserId()
  });
  
  return definition;
}

// Field name validation
function validateFieldName(name: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error('Field name must be lowercase with underscores only');
  }
  if (name.length > 50) {
    throw new Error('Field name must be 50 characters or less');
  }
  const reserved = ['id', 'project_id', 'created_at', 'updated_at', 'deleted_at', 
                    'name', 'email', 'status', 'type', 'custom_fields'];
  if (reserved.includes(name)) {
    throw new Error(`"${name}" is a reserved field name`);
  }
}
```

### READ Fields

```typescript
// GET /api/projects/[slug]/schema/fields?entity_type=organization

async function getFieldDefinitions(projectId: string, entityType?: string) {
  let query = supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('project_id', projectId)
    .order('display_order');
  
  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  
  const { data } = await query;
  return data;
}

// Get field values for an entity (from JSONB)
async function getEntityWithCustomFields(
  entityType: string, 
  entityId: string
) {
  const tableName = `${entityType}s`;
  
  const { data } = await supabase
    .from(tableName)
    .select('*, custom_fields')
    .eq('id', entityId)
    .single();
  
  return data;
}
```

### UPDATE Field

```typescript
// PATCH /api/projects/[slug]/schema/fields/[fieldId]

interface UpdateFieldRequest {
  display_name?: string;
  description?: string;
  placeholder?: string;
  is_required?: boolean;
  validation_rules?: ValidationRules;
  options?: SelectOption[];
  is_ai_extractable?: boolean;
  ai_extraction_hint?: string;
  ai_confidence_threshold?: number;
  display_order?: number;
  show_in_list_view?: boolean;
  show_in_card_view?: boolean;
}

// NOTE: field_name and field_type CANNOT be changed after creation
// Changing these would require data migration

async function updateField(projectId: string, fieldId: string, data: UpdateFieldRequest) {
  // 1. Get current definition
  const { data: oldDefinition } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('id', fieldId)
    .eq('project_id', projectId)
    .single();
  
  if (!oldDefinition) throw new Error('Field not found');
  
  // 2. Update definition
  const { data: updated, error } = await supabase
    .from('custom_field_definitions')
    .update({
      ...data,
      updated_at: new Date()
    })
    .eq('id', fieldId)
    .select()
    .single();
  
  if (error) throw error;
  
  // 3. Log change
  await supabase.from('schema_audit_log').insert({
    project_id: projectId,
    action: 'update_field',
    entity_type: oldDefinition.entity_type,
    field_name: oldDefinition.field_name,
    old_definition: oldDefinition,
    new_definition: updated,
    performed_by: getCurrentUserId()
  });
  
  return updated;
}
```

### DELETE Field (Destructive)

```typescript
// DELETE /api/projects/[slug]/schema/fields/[fieldId]

interface DeleteFieldRequest {
  confirmation_text: string; // Must be exactly "DELETE {field_name}"
}

async function deleteField(
  projectId: string, 
  fieldId: string, 
  confirmation: DeleteFieldRequest
) {
  // 1. Get field definition
  const { data: definition } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('id', fieldId)
    .eq('project_id', projectId)
    .single();
  
  if (!definition) throw new Error('Field not found');
  
  // 2. Validate confirmation text (EXACT match required)
  const expectedText = `DELETE ${definition.field_name}`;
  if (confirmation.confirmation_text !== expectedText) {
    throw new Error(`To confirm deletion, type exactly: ${expectedText}`);
  }
  
  // 3. Count affected records and get sample
  const tableName = `${definition.entity_type}s`;
  
  const { count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .not('custom_fields', 'is', null)
    .filter(`custom_fields->>${definition.field_name}`, 'not.is', null);
  
  const { data: sample } = await supabase
    .from(tableName)
    .select(`id, custom_fields->>${definition.field_name} as value`)
    .eq('project_id', projectId)
    .not(`custom_fields->>${definition.field_name}`, 'is', null)
    .limit(10);
  
  // 4. Remove field data from all records in this project
  // Uses JSONB operator to remove key
  await supabase.rpc('remove_custom_field_data', {
    p_table_name: tableName,
    p_project_id: projectId,
    p_field_name: definition.field_name
  });
  
  // 5. Delete the definition
  await supabase
    .from('custom_field_definitions')
    .delete()
    .eq('id', fieldId);
  
  // 6. Log with audit trail
  await supabase.from('schema_audit_log').insert({
    project_id: projectId,
    action: 'delete_field',
    entity_type: definition.entity_type,
    field_name: definition.field_name,
    old_definition: definition,
    affected_record_count: count,
    data_sample: sample,
    confirmation_text: confirmation.confirmation_text,
    performed_by: getCurrentUserId()
  });
  
  return { 
    success: true, 
    deleted_field: definition.field_name,
    affected_records: count 
  };
}
```

### Database Function for Removing Field Data

```sql
-- Removes a field from custom_fields JSONB for all records in a project
CREATE OR REPLACE FUNCTION remove_custom_field_data(
  p_table_name TEXT,
  p_project_id UUID,
  p_field_name TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Validate table name (whitelist)
  IF p_table_name NOT IN ('organizations', 'people', 'opportunities', 'rfps') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  -- Remove the key from custom_fields JSONB
  -- The '-' operator removes a key from JSONB
  EXECUTE format(
    'UPDATE %I 
     SET custom_fields = custom_fields - $1,
         updated_at = NOW()
     WHERE project_id = $2 
       AND custom_fields ? $1',
    p_table_name
  ) USING p_field_name, p_project_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Saving Custom Field Values

```typescript
// When saving an entity, custom fields go into the JSONB column

async function updateOrganization(
  orgId: string, 
  systemFields: Partial<Organization>,
  customFieldValues: Record<string, any>
) {
  const { data, error } = await supabase
    .from('organizations')
    .update({
      // System fields (spread directly)
      ...systemFields,
      
      // Custom fields (merge into JSONB)
      custom_fields: customFieldValues,
      
      updated_at: new Date()
    })
    .eq('id', orgId)
    .select()
    .single();
  
  return data;
}

// Or merge with existing custom fields (preserve unset fields)
async function updateCustomFields(
  entityType: string,
  entityId: string,
  updates: Record<string, any>
) {
  const tableName = `${entityType}s`;
  
  // Use JSONB concatenation to merge
  const { data, error } = await supabase.rpc('merge_custom_fields', {
    p_table_name: tableName,
    p_entity_id: entityId,
    p_updates: updates
  });
  
  return data;
}

-- SQL function for merging
CREATE OR REPLACE FUNCTION merge_custom_fields(
  p_table_name TEXT,
  p_entity_id UUID,
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  EXECUTE format(
    'UPDATE %I 
     SET custom_fields = COALESCE(custom_fields, $1::jsonb) || $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING custom_fields',
    p_table_name
  ) USING '{}'::jsonb, p_updates, p_entity_id
  INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 9.6 Schema Manager UI

### Field List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Settings > Schema Manager                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Entity: [Organizations ▼]                              [+ Add Field]        │
│                                                                             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│ SYSTEM FIELDS (read-only)                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔒 name              Text         Organization name           Required  │ │
│ │ 🔒 website           URL          Primary website                       │ │
│ │ 🔒 type              Select       Organization type                     │ │
│ │ 🔒 status            Select       Active/Inactive                       │ │
│ │ 🔒 owner_id          Relation     Assigned owner              Required  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ CUSTOM FIELDS                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ⋮⋮ water_ph_level    Number       Water pH Level              [✎] [🗑️] │ │
│ │    🤖 AI: "Extract pH level from water quality reports"                 │ │
│ │ ─────────────────────────────────────────────────────────────────────── │ │
│ │ ⋮⋮ treatment_method  Select       Treatment Method            [✎] [🗑️] │ │
│ │    🤖 AI: "Identify wastewater treatment technology"                    │ │
│ │    Options: Activated Sludge, Lagoon, MBR, Other                        │ │
│ │ ─────────────────────────────────────────────────────────────────────── │ │
│ │ ⋮⋮ epa_violations    Boolean      EPA Violations (3yr)        [✎] [🗑️] │ │
│ │    🤖 AI: "Check for EPA violations in past 3 years"                    │ │
│ │ ─────────────────────────────────────────────────────────────────────── │ │
│ │ ⋮⋮ annual_budget     Currency     Annual Budget               [✎] [🗑️] │ │
│ │    🤖 AI: "Find annual water/wastewater budget"                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Drag ⋮⋮ to reorder fields                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Add/Edit Field Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Add Custom Field                                                    [✕]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ BASIC INFO                                                                  │
│                                                                             │
│ Display Name *                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Water pH Level                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Field Name (database column) *                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ water_ph_level                                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ℹ️ Lowercase, underscores only. Cannot be changed after creation.           │
│                                                                             │
│ Field Type *                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Number                                                                ▼ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ⚠️ Cannot be changed after creation.                                        │
│                                                                             │
│ Description                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ The pH level of treated water output                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ AI RESEARCH INTEGRATION                                                     │
│                                                                             │
│ [✓] Include in AI research                                                  │
│                                                                             │
│ AI Extraction Hint                                                          │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Look for pH levels in water quality reports, EPA filings, or facility   │ │
│ │ documentation. Typical range is 6.5-8.5.                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ℹ️ Instructions to help AI find and extract this data accurately.           │
│                                                                             │
│ Minimum Confidence to Auto-Fill                                             │
│ ○────────────●────────────────────────────────────────────────────────────○ │
│ 0%           70%                                                       100% │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ VALIDATION                                                                  │
│                                                                             │
│ [ ] Required for new records                                                │
│                                                                             │
│ Minimum Value: [0        ]    Maximum Value: [14       ]                    │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ DISPLAY                                                                     │
│                                                                             │
│ [ ] Show in list/table view                                                 │
│ [✓] Show in card/detail view                                                │
│                                                                             │
│                                            [Cancel]  [Create Field]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Delete Field Confirmation (Destructive)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Delete Field Permanently                                          [✕]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  🔴  THIS ACTION IS IRREVERSIBLE                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ You are about to permanently delete the field:                              │
│                                                                             │
│   Field: water_ph_level                                                     │
│   Type: Number                                                              │
│   Entity: Organizations                                                     │
│                                                                             │
│ This will:                                                                  │
│   • Drop the column from the database                                       │
│   • Delete ALL data stored in this field (47 values)                        │
│   • Remove the field from all forms and views                               │
│   • Remove the field from AI research prompts                               │
│                                                                             │
│ This action CANNOT be undone. The data will be permanently lost.            │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│ To confirm, type: DELETE water_ph_level                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
│                           [Cancel]  [Delete Permanently]                    │
│                                     (disabled until text matches)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.8 AI Research Integration

### Building Research Prompts with Custom Fields

```typescript
async function buildResearchPrompt(
  projectId: string, 
  entityType: string, 
  inputs: ResearchInput
): Promise<{ prompt: string; schema: JSONSchema }> {
  // 1. Get system fields for this entity type
  const systemFields = SYSTEM_FIELDS[entityType];
  
  // 2. Get custom fields marked for AI extraction
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('is_ai_extractable', true)
    .order('display_order');
  
  // 3. Combine for prompt building
  const allFields = [
    ...systemFields.map(f => ({
      name: f.field_name,
      type: f.field_type,
      hint: f.description,
      isSystem: true
    })),
    ...customFields.map(f => ({
      name: f.field_name,
      type: f.field_type,
      hint: f.ai_extraction_hint || f.description,
      options: f.options,
      isSystem: false
    }))
  ];
  
  // 4. Build prompt
  const prompt = `
You are researching a ${entityType}. Extract the following information:

## System Fields
${systemFields.map(f => `- **${f.display_name}**: ${f.description || f.field_name}`).join('\n')}

## Custom Fields (Project-Specific)
${customFields.map(f => `
### ${f.display_name} (${f.field_type})
${f.ai_extraction_hint || f.description || 'Extract if available'}
${f.options ? `Options: ${f.options.map(o => o.value).join(', ')}` : ''}
`).join('\n')}

For each field, provide:
- The extracted value (or null if not found)
- A confidence score (0.0 to 1.0)
- The source URL where you found the information

Return structured JSON matching the provided schema.
`;

  // 5. Build JSON schema for structured output
  const schema = buildDynamicJsonSchema(systemFields, customFields);
  
  return { prompt, schema };
}
```

### Dynamic JSON Schema for Structured Output

```typescript
function buildDynamicJsonSchema(
  systemFields: FieldDefinition[],
  customFields: FieldDefinition[]
): JSONSchema {
  const properties: Record<string, any> = {};
  
  // System fields
  for (const field of systemFields) {
    properties[field.field_name] = {
      type: 'object',
      properties: {
        value: getJsonSchemaType(field.field_type),
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        source: { type: ['string', 'null'] }
      },
      required: ['value', 'confidence']
    };
  }
  
  // Custom fields (stored in custom_fields JSONB)
  const customFieldsSchema: Record<string, any> = {};
  for (const field of customFields) {
    customFieldsSchema[field.field_name] = {
      type: 'object',
      properties: {
        value: getJsonSchemaType(field.field_type, field.options),
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        source: { type: ['string', 'null'] }
      },
      required: ['value', 'confidence']
    };
  }
  
  return {
    type: 'object',
    properties: {
      system_fields: {
        type: 'object',
        properties,
        additionalProperties: false
      },
      custom_fields: {
        type: 'object',
        properties: customFieldsSchema,
        additionalProperties: false
      },
      summary: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } }
    },
    required: ['system_fields', 'custom_fields', 'summary', 'sources']
  };
}

function getJsonSchemaType(fieldType: string, options?: SelectOption[]): object {
  switch (fieldType) {
    case 'text':
    case 'long_text':
    case 'url':
    case 'email':
    case 'phone':
      return { type: ['string', 'null'] };
    case 'number':
    case 'currency':
    case 'percentage':
    case 'rating':
      return { type: ['number', 'null'] };
    case 'boolean':
      return { type: ['boolean', 'null'] };
    case 'date':
    case 'datetime':
      return { type: ['string', 'null'], format: 'date' };
    case 'select':
      return { 
        type: ['string', 'null'], 
        enum: [...(options?.map(o => o.value) || []), null] 
      };
    case 'multi_select':
      return { 
        type: ['array', 'null'], 
        items: { type: 'string', enum: options?.map(o => o.value) || [] } 
      };
    case 'json':
      return { type: ['object', 'null'] };
    default:
      return { type: ['string', 'null'] };
  }
}
```

### Applying Research Results

```typescript
async function applyResearchResults(
  entityType: string,
  entityId: string,
  projectId: string,
  results: AIResearchResults
) {
  const tableName = `${entityType}s`;
  
  // Get field definitions to check confidence thresholds
  const { data: customFieldDefs } = await supabase
    .from('custom_field_definitions')
    .select('field_name, ai_confidence_threshold')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('is_ai_extractable', true);
  
  const thresholds = new Map(
    customFieldDefs?.map(f => [f.field_name, f.ai_confidence_threshold]) || []
  );
  
  // 1. Extract system field updates (high confidence only)
  const systemUpdates: Record<string, any> = {};
  for (const [fieldName, result] of Object.entries(results.system_fields)) {
    if (result.value !== null && result.confidence >= 0.7) {
      systemUpdates[fieldName] = result.value;
    }
  }
  
  // 2. Extract custom field updates (per-field thresholds)
  const customFieldUpdates: Record<string, any> = {};
  const lowConfidenceFields: Array<{
    field: string;
    value: any;
    confidence: number;
  }> = [];
  
  for (const [fieldName, result] of Object.entries(results.custom_fields)) {
    const threshold = thresholds.get(fieldName) ?? 0.7;
    
    if (result.value !== null) {
      if (result.confidence >= threshold) {
        customFieldUpdates[fieldName] = result.value;
      } else {
        // Flag for user review
        lowConfidenceFields.push({
          field: fieldName,
          value: result.value,
          confidence: result.confidence
        });
      }
    }
  }
  
  // 3. Update entity - system fields spread directly, custom fields merged into JSONB
  const { data: existingEntity } = await supabase
    .from(tableName)
    .select('custom_fields')
    .eq('id', entityId)
    .single();
  
  const mergedCustomFields = {
    ...existingEntity?.custom_fields,
    ...customFieldUpdates
  };
  
  await supabase
    .from(tableName)
    .update({
      // System fields
      ...systemUpdates,
      
      // Custom fields merged into JSONB
      custom_fields: mergedCustomFields,
      
      // Research metadata
      research_summary: results.summary,
      research_freshness: new Date(),
      updated_at: new Date()
    })
    .eq('id', entityId);
  
  // 4. Return results for UI
  return {
    applied_system_fields: Object.keys(systemUpdates),
    applied_custom_fields: Object.keys(customFieldUpdates),
    needs_review: lowConfidenceFields,
    sources: results.sources
  };
}
```

### Research Results UI with Custom Fields

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Research Results: Portland Water Bureau                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ AUTO-APPLIED (High Confidence)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Website          portlandwater.org                    98% confidence    │ │
│ │ Jurisdiction     Portland, OR                         95% confidence    │ │
│ │ Type             Municipal                            92% confidence    │ │
│ │ water_ph         7.2                                  88% confidence    │ │
│ │ epa_violations   false                                85% confidence    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ⚠️ NEEDS REVIEW (Below Confidence Threshold)                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ annual_budget    $45,000,000                          62% confidence    │ │
│ │                  Source: 2023 Annual Report PDF                         │ │
│ │                                              [Accept] [Edit] [Reject]   │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ treatment_method MBR                                  55% confidence    │ │
│ │                  Source: Facility description page                      │ │
│ │                                              [Accept] [Edit] [Reject]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ 📚 SOURCES                                                                  │
│ • https://portlandwater.org/about                                           │
│ • https://portlandwater.org/facilities                                      │
│ • https://oregon.gov/deq/permits/portland-water                             │
│                                                                             │
│                                                         [Done]              │
└─────────────────────────────────────────────────────────────────────────────┘
```
```

## 9.7 Dynamic Form Rendering

Forms dynamically render custom fields based on definitions:

```typescript
// components/forms/dynamic-fields.tsx
'use client';

import { useCustomFields } from '@/hooks/use-custom-fields';
import { DynamicField } from './dynamic-field';

interface DynamicFieldsProps {
  entityType: 'organization' | 'person' | 'opportunity' | 'rfp';
  customFieldValues: Record<string, any>;  // From entity.custom_fields
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}

export function DynamicFields({ 
  entityType, 
  customFieldValues, 
  onChange, 
  errors 
}: DynamicFieldsProps) {
  const { fields, isLoading } = useCustomFields(entityType);
  
  if (isLoading) {
    return <DynamicFieldsSkeleton count={3} />;
  }
  
  if (fields.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground-secondary">
        Custom Fields
      </h3>
      {fields.map((field) => (
        <DynamicField
          key={field.id}
          definition={field}
          value={customFieldValues?.[field.field_name]}
          onChange={(value) => onChange(field.field_name, value)}
          error={errors?.[field.field_name]}
        />
      ))}
    </div>
  );
}

// Usage in entity form
function OrganizationForm({ organization }: { organization?: Organization }) {
  const [systemFields, setSystemFields] = useState({
    name: organization?.name || '',
    website: organization?.website || '',
    type: organization?.type || '',
  });
  
  const [customFields, setCustomFields] = useState<Record<string, any>>(
    organization?.custom_fields || {}
  );
  
  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFields(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };
  
  const handleSubmit = async () => {
    await supabase
      .from('organizations')
      .upsert({
        id: organization?.id,
        ...systemFields,
        custom_fields: customFields,  // JSONB column
      });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* System fields */}
      <Input name="name" value={systemFields.name} ... />
      <Input name="website" value={systemFields.website} ... />
      <Select name="type" value={systemFields.type} ... />
      
      {/* Custom fields - dynamically rendered from JSONB */}
      <DynamicFields
        entityType="organization"
        customFieldValues={customFields}
        onChange={handleCustomFieldChange}
      />
      
      <Button type="submit">Save</Button>
    </form>
  );
}
```

### Dynamic Field Component

```typescript
// components/forms/dynamic-field.tsx
export function DynamicField({ 
  definition, 
  value, 
  onChange, 
  error 
}: DynamicFieldProps) {
  const { 
    field_type, 
    display_name, 
    description, 
    placeholder, 
    options, 
    is_required,
    validation_rules 
  } = definition;
  
  const renderInput = () => {
    switch (field_type) {
      case 'text':
        return (
          <Input 
            value={value ?? ''} 
            onChange={e => onChange(e.target.value)} 
            placeholder={placeholder}
            maxLength={validation_rules?.max}
          />
        );
      
      case 'long_text':
        return (
          <Textarea 
            value={value ?? ''} 
            onChange={e => onChange(e.target.value)} 
            placeholder={placeholder}
          />
        );
      
      case 'number':
        return (
          <Input 
            type="number"
            value={value ?? ''} 
            onChange={e => onChange(e.target.valueAsNumber || null)}
            min={validation_rules?.min}
            max={validation_rules?.max}
          />
        );
      
      case 'currency':
        return (
          <CurrencyInput
            value={value}
            onChange={onChange}
            currency="USD"
          />
        );
      
      case 'percentage':
        return (
          <PercentageInput
            value={value}
            onChange={onChange}
          />
        );
      
      case 'boolean':
        return (
          <Switch 
            checked={value ?? false} 
            onCheckedChange={onChange}
          />
        );
      
      case 'select':
        return (
          <Select value={value ?? ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((opt: SelectOption) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'multi_select':
        return (
          <MultiSelect
            options={options || []}
            selected={value || []}
            onChange={onChange}
            placeholder={placeholder}
          />
        );
      
      case 'date':
        return (
          <DatePicker
            value={value ? new Date(value) : undefined}
            onChange={(date) => onChange(date?.toISOString().split('T')[0] || null)}
          />
        );
      
      case 'datetime':
        return (
          <DateTimePicker
            value={value ? new Date(value) : undefined}
            onChange={(date) => onChange(date?.toISOString() || null)}
          />
        );
      
      case 'url':
        return (
          <Input 
            type="url"
            value={value ?? ''} 
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || 'https://...'}
          />
        );
      
      case 'email':
        return (
          <Input 
            type="email"
            value={value ?? ''} 
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder || 'email@example.com'}
          />
        );
      
      case 'phone':
        return (
          <PhoneInput
            value={value ?? ''}
            onChange={onChange}
          />
        );
      
      case 'rating':
        return (
          <StarRating
            value={value ?? 0}
            onChange={onChange}
            max={5}
          />
        );
      
      case 'json':
        return (
          <JsonEditor
            value={value}
            onChange={onChange}
          />
        );
      
      default:
        return (
          <Input 
            value={value ?? ''} 
            onChange={e => onChange(e.target.value)}
          />
        );
    }
  };
  
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {display_name}
        {is_required && <span className="text-error">*</span>}
      </Label>
      {renderInput()}
      {description && (
        <p className="text-sm text-foreground-muted">{description}</p>
      )}
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
    </div>
  );
}
```

### Custom Fields Hook

```typescript
// hooks/use-custom-fields.ts
import { useQuery } from '@tanstack/react-query';
import { useProjectContext } from '@/providers/project-provider';

export function useCustomFields(entityType: string) {
  const { projectId } = useProjectContext();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['custom-fields', projectId, entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('project_id', projectId)
        .eq('entity_type', entityType)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  return {
    fields: data ?? [],
    isLoading,
    error
  };
}
```
```

---

# Section 18: Dashboard

## 18.1 Overview

The dashboard is the first thing users see after selecting a project. It provides an at-a-glance view of pipeline health, pending tasks, recent activity, and research freshness.

## 18.2 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                                     [Last 30 days▼]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │
│ │ PIPELINE VALUE  │ │ OPEN OPPS       │ │ RFPs DUE        │ │ TASKS DUE   │ │
│ │                 │ │                 │ │                 │ │             │ │
│ │   $2.4M         │ │      12         │ │      3          │ │     7       │ │
│ │   ↑ 15%         │ │   ↑ 2 new       │ │   this week     │ │   today     │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────┘ │
│                                                                             │
│ ┌────────────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ PIPELINE BY STAGE                      │ │ MY TASKS                     │ │
│ │                                        │ │                              │ │
│ │ Lead          ████████████  $800K (8)  │ │ ☐ Call John Smith      Today │ │
│ │ Qualified     ██████        $400K (4)  │ │ ☐ Send proposal        Today │ │
│ │ RFP Identified████████      $600K (3)  │ │ ☐ Research Portland    Tmrw  │ │
│ │ Proposal Sent ████          $300K (2)  │ │ ☐ Follow up RFP        Fri   │ │
│ │ Negotiation   ██            $300K (1)  │ │                              │ │
│ │                                        │ │ [View All Tasks →]           │ │
│ └────────────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                             │
│ ┌────────────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ RESEARCH HEALTH                        │ │ RFP DEADLINES                │ │
│ │                                        │ │                              │ │
│ │ Organizations: 45 total                │ │ 🔴 Portland RFP      Jan 31  │ │
│ │ ┌──────────────────────────────────┐   │ │ 🟡 Seattle RFP       Feb 15  │ │
│ │ │ 🟢 Fresh (<30d)      28  62%     │   │ │ 🟢 Denver RFP        Mar 1   │ │
│ │ │ 🟡 Aging (30-90d)    12  27%     │   │ │                              │ │
│ │ │ 🔴 Stale (>90d)       5  11%     │   │ │                              │ │
│ │ └──────────────────────────────────┘   │ │ [View All RFPs →]            │ │
│ │                                        │ │                              │ │
│ │ [Refresh Stale Research]               │ │                              │ │
│ └────────────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                             │
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │ RECENT ACTIVITY                                           [View All →]│   │
│ │                                                                       │   │
│ │ 🔬 Research completed on Portland Water Bureau           2 hours ago  │   │
│ │ 📧 Email opened: John Smith (Portland)                   3 hours ago  │   │
│ │ 💬 Reply received from Sarah Lee (Seattle)               5 hours ago  │   │
│ │ ✅ Task completed: Send proposal to Denver               Yesterday    │   │
│ │ 🏢 New organization added: Phoenix Water                 Yesterday    │   │
│ │ 📋 RFP discovered: San Diego Wastewater                  2 days ago   │   │
│ └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 18.3 Dashboard Widgets

### Pipeline Summary Widget
```typescript
interface PipelineStats {
  total_value: number;
  total_count: number;
  value_change_percent: number;  // vs previous period
  by_stage: Array<{
    stage: string;
    value: number;
    count: number;
  }>;
}
```

### Research Health Widget
```typescript
interface ResearchHealth {
  total_organizations: number;
  fresh_count: number;      // < 30 days
  aging_count: number;      // 30-90 days
  stale_count: number;      // > 90 days
  stale_organizations: Array<{
    id: string;
    name: string;
    last_researched_at: Date;
  }>;
}
```

### Tasks Widget
```typescript
interface TasksWidget {
  due_today: number;
  overdue: number;
  upcoming_tasks: Task[];  // Next 5
}
```

## 18.4 Database Queries

```sql
-- Dashboard stats (single RPC call)
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_project_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pipeline', (
      SELECT jsonb_build_object(
        'total_value', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'by_stage', jsonb_agg(jsonb_build_object(
          'stage', stage,
          'value', stage_value,
          'count', stage_count
        ))
      )
      FROM (
        SELECT stage, SUM(amount) as stage_value, COUNT(*) as stage_count
        FROM opportunities
        WHERE project_id = p_project_id AND deleted_at IS NULL
          AND stage NOT IN ('closed_won', 'closed_lost')
        GROUP BY stage
      ) stages
    ),
    'tasks', (
      SELECT jsonb_build_object(
        'due_today', COUNT(*) FILTER (WHERE due_at::date = CURRENT_DATE),
        'overdue', COUNT(*) FILTER (WHERE due_at < CURRENT_DATE AND status = 'pending'),
        'total_pending', COUNT(*) FILTER (WHERE status = 'pending')
      )
      FROM tasks
      WHERE project_id = p_project_id AND assigned_to = p_user_id
    ),
    'research', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'fresh', COUNT(*) FILTER (WHERE research_freshness > CURRENT_DATE - INTERVAL '30 days'),
        'aging', COUNT(*) FILTER (WHERE research_freshness BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE - INTERVAL '30 days'),
        'stale', COUNT(*) FILTER (WHERE research_freshness < CURRENT_DATE - INTERVAL '90 days' OR research_freshness IS NULL)
      )
      FROM organizations
      WHERE project_id = p_project_id AND deleted_at IS NULL
    ),
    'rfps_due', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'due_date', due_date,
        'days_until', due_date - CURRENT_DATE
      ) ORDER BY due_date)
      FROM rfps
      WHERE project_id = p_project_id 
        AND status IN ('reviewing', 'pursuing')
        AND due_date >= CURRENT_DATE
      LIMIT 5
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

# Section 19: Tasks & Reminders

## 19.1 Overview

Tasks are to-do items linked to any entity (organization, person, opportunity, RFP) with due dates, priorities, and assignments.

## 19.2 Database Schema

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Timing
  due_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,  -- When to send reminder notification
  
  -- Priority & Status
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  
  -- Linked entity (polymorphic)
  entity_type TEXT CHECK (entity_type IN ('organization', 'person', 'opportunity', 'rfp')),
  entity_id UUID,
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  
  -- Recurrence (optional)
  recurrence_rule TEXT,  -- RRULE format: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  parent_task_id UUID REFERENCES tasks(id),  -- For recurring task instances
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due ON tasks(due_at) WHERE status = 'pending';
CREATE INDEX idx_tasks_entity ON tasks(entity_type, entity_id);
```

## 19.3 Task UI

### Task List View
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Tasks                                                   [+ Add Task]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filter: [All ▼]  Status: [Pending ▼]  Assigned: [Me ▼]      🔍 Search...   │
│                                                                             │
│ TODAY (3)                                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐ 🔴 Call John Smith about RFP                                          │ │
│ │      Portland Water Bureau · Due today                     [@Jane]      │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ ☐ 🟡 Send proposal draft                                                │ │
│ │      Denver Water · Due today                              [@Jane]      │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ ☐ 🟡 Review RFP requirements                                            │ │
│ │      Seattle RFP · Due today                               [@Jane]      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ TOMORROW (2)                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐    Research Phoenix Water                                             │ │
│ │      Phoenix Water · Due Jan 30                            [@Jane]      │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ ☐    Follow up with Sarah                                               │ │
│ │      Seattle Public Utilities · Due Jan 30                 [@Jane]      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ OVERDUE (1)                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐ 🔴 Update CRM notes                                                   │ │
│ │      No linked entity · Due Jan 27 (2 days ago)            [@Jane]      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Section 20: Global Search

## 20.1 Overview

Search across all entities from a single search bar. Results are grouped by type with keyboard navigation.

## 20.2 Search UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Search everything...                                              ⌘K    │
└─────────────────────────────────────────────────────────────────────────────┘

[Opens modal on click or ⌘K]

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 portland                                                          [ESC] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ORGANIZATIONS                                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🏢 Portland Water Bureau                                                │ │
│ │    Municipality · Oregon                                                │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 🏢 Portland General Electric                                            │ │
│ │    Utility · Oregon                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PEOPLE                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith                                                           │ │
│ │    Director · Portland Water Bureau                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ RFPS                                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📋 Portland Wastewater Treatment Upgrade                                │ │
│ │    Due Feb 15 · $2.5M                                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ EMAILS                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📧 "Re: Portland RFP Questions"                                         │ │
│ │    To: John Smith · Jan 25                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ↑↓ Navigate  ↵ Select  ESC Close                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 20.3 Search Implementation

```sql
-- Full-text search across entities
CREATE OR REPLACE FUNCTION global_search(
  p_project_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  subtitle TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  
  -- Organizations
  SELECT 
    'organization'::TEXT,
    o.id,
    o.name,
    COALESCE(o.type || ' · ' || o.jurisdiction, o.type, ''),
    ts_rank(to_tsvector('english', o.name || ' ' || COALESCE(o.website, '')), plainto_tsquery(p_query))
  FROM organizations o
  WHERE o.project_id = p_project_id 
    AND o.deleted_at IS NULL
    AND (
      o.name ILIKE '%' || p_query || '%'
      OR o.website ILIKE '%' || p_query || '%'
      OR to_tsvector('english', o.name) @@ plainto_tsquery(p_query)
    )
  
  UNION ALL
  
  -- People
  SELECT 
    'person'::TEXT,
    p.id,
    p.first_name || ' ' || p.last_name,
    COALESCE(p.title || ' · ' || (SELECT name FROM organizations WHERE id = po.organization_id), p.title, ''),
    ts_rank(to_tsvector('english', p.first_name || ' ' || p.last_name || ' ' || COALESCE(p.email, '')), plainto_tsquery(p_query))
  FROM people p
  LEFT JOIN person_organizations po ON po.person_id = p.id AND po.is_primary = TRUE
  WHERE p.project_id = p_project_id 
    AND p.deleted_at IS NULL
    AND (
      p.first_name ILIKE '%' || p_query || '%'
      OR p.last_name ILIKE '%' || p_query || '%'
      OR p.email ILIKE '%' || p_query || '%'
    )
  
  UNION ALL
  
  -- Opportunities
  SELECT 
    'opportunity'::TEXT,
    opp.id,
    opp.name,
    opp.stage || ' · $' || opp.amount::TEXT,
    ts_rank(to_tsvector('english', opp.name), plainto_tsquery(p_query))
  FROM opportunities opp
  WHERE opp.project_id = p_project_id 
    AND opp.deleted_at IS NULL
    AND opp.name ILIKE '%' || p_query || '%'
  
  UNION ALL
  
  -- RFPs
  SELECT 
    'rfp'::TEXT,
    r.id,
    r.title,
    'Due ' || to_char(r.due_date, 'Mon DD'),
    ts_rank(to_tsvector('english', r.title || ' ' || COALESCE(r.rfp_number, '')), plainto_tsquery(p_query))
  FROM rfps r
  WHERE r.project_id = p_project_id 
    AND r.deleted_at IS NULL
    AND (
      r.title ILIKE '%' || p_query || '%'
      OR r.rfp_number ILIKE '%' || p_query || '%'
    )
  
  ORDER BY relevance DESC
  LIMIT p_limit * 4;  -- Return up to limit per category
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

# Section 21: Notes

## 21.1 Overview

Notes can be attached to any entity. They support rich text and can be pinned for visibility.

## 21.2 Database Schema

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Content
  title TEXT,
  content TEXT NOT NULL,           -- Markdown supported
  content_html TEXT,               -- Rendered HTML (cached)
  
  -- Linked entity
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'person', 'opportunity', 'rfp')),
  entity_id UUID NOT NULL,
  
  -- Display
  is_pinned BOOLEAN DEFAULT FALSE,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_pinned ON notes(entity_type, entity_id, is_pinned) WHERE is_pinned = TRUE;
```

---

# Section 22: Tags & Labels

## 22.1 Overview

Tags provide flexible categorization across all entities. Tags are project-scoped and color-coded.

## 22.2 Database Schema

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'muted',  -- CSS variable: success, warning, error, info, muted, primary
  description TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, name)
);

CREATE TABLE entity_tags (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'person', 'opportunity', 'rfp')),
  entity_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  
  tagged_by UUID REFERENCES users(id),
  tagged_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (entity_type, entity_id, tag_id)
);

CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
```

## 22.3 Tag UI

```typescript
// components/tags/tag-badge.tsx
export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        'bg-${tag.color}-light text-${tag.color}',
        // e.g., bg-success-light text-success
      )}
    >
      {tag.name}
    </Badge>
  );
}

// components/tags/tag-input.tsx
export function TagInput({ entityType, entityId, currentTags, onTagsChange }: TagInputProps) {
  const { tags: allTags } = useProjectTags();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="flex flex-wrap gap-1">
      {currentTags.map(tag => (
        <TagBadge key={tag.id} tag={tag} onRemove={() => removeTag(tag.id)} />
      ))}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">+ Add tag</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Command>
            <CommandInput placeholder="Search or create tag..." />
            <CommandList>
              {allTags.filter(t => !currentTags.find(ct => ct.id === t.id)).map(tag => (
                <CommandItem key={tag.id} onSelect={() => addTag(tag.id)}>
                  <TagBadge tag={tag} />
                </CommandItem>
              ))}
              <CommandItem onSelect={createNewTag}>
                + Create new tag
              </CommandItem>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

---

# Section 23: Email Templates (One-Off)

## 23.1 Overview

Email templates are reusable email content for one-off sends (not sequences). They support variables and AI personalization.

## 23.2 Database Schema

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,
  
  -- Metadata
  variables_used TEXT[],           -- Detected variables: ['first_name', 'company_name']
  category TEXT,                   -- 'introduction', 'follow_up', 'meeting_request', etc.
  
  -- AI settings
  ai_personalization_enabled BOOLEAN DEFAULT FALSE,
  ai_instructions TEXT,
  
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_project ON email_templates(project_id);
```

## 23.3 Send One-Off Email Flow

```
Person Detail View > [Send Email ▼]
                          │
                          ├─ Compose new
                          └─ From template
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Send Email to John Smith                                             [✕]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Template: [Introduction - Municipal ▼]            [Clear] [AI Personalize] │
│                                                                             │
│ To: john.smith@portlandwater.gov                                            │
│                                                                             │
│ Subject:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ John - Introduction from GoodRev                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Body:                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Hi John,                                                                │ │
│ │                                                                         │ │
│ │ I'm reaching out because Portland Water Bureau caught my attention...  │ │
│ │                                                                         │ │
│ │ [AI-personalized content based on research]                             │ │
│ │                                                                         │ │
│ │ Would you be open to a brief call next week?                            │ │
│ │                                                                         │ │
│ │ Best,                                                                   │ │
│ │ Jane                                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Signature: [Default ▼]                                                      │
│                                                                             │
│ [ ] Track opens   [ ] Track clicks   [ ] Log as activity                    │
│                                                                             │
│                                                     [Cancel]  [Send Email]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Section 24: Notifications System

## 24.1 Overview

In-app and email notifications for important events: task reminders, email replies, RFP deadlines, mentions.

## 24.2 Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification content
  type TEXT NOT NULL CHECK (type IN (
    'task_due', 'task_overdue', 'task_assigned',
    'email_reply', 'email_bounced',
    'rfp_deadline', 'rfp_discovered',
    'research_complete', 'research_stale',
    'mention', 'assignment',
    'sequence_completed', 'sequence_reply'
  )),
  title TEXT NOT NULL,
  body TEXT,
  
  -- Linked entity
  entity_type TEXT,
  entity_id UUID,
  
  -- Action URL
  action_url TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Email delivery
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
```

## 24.3 Notification Preferences

```sql
-- Add to user_preferences
CREATE TABLE user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  
  -- In-app (always on)
  
  -- Email preferences
  email_task_due BOOLEAN DEFAULT TRUE,
  email_task_assigned BOOLEAN DEFAULT TRUE,
  email_email_reply BOOLEAN DEFAULT TRUE,
  email_rfp_deadline BOOLEAN DEFAULT TRUE,
  email_mention BOOLEAN DEFAULT TRUE,
  
  -- Digest preferences
  email_digest_enabled BOOLEAN DEFAULT FALSE,
  email_digest_frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  email_digest_time TIME DEFAULT '09:00',
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 24.4 Notification Bell UI

```
┌─────────────────────────────────────────┐
│ 🔔 (3)                                  │  <- Bell icon with unread count
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Notifications                [Mark all] │
├─────────────────────────────────────────┤
│                                         │
│ ● Task due: Call John Smith      2m ago │
│   Portland Water Bureau                 │
│ ─────────────────────────────────────── │
│ ● Reply received from Sarah Lee  1h ago │
│   Seattle Public Utilities              │
│ ─────────────────────────────────────── │
│ ● RFP deadline in 3 days        3h ago  │
│   Portland Wastewater RFP               │
│ ─────────────────────────────────────── │
│ ○ Research completed             1d ago │
│   Denver Water                          │
│                                         │
│ [View All Notifications]                │
└─────────────────────────────────────────┘
```

---

# Section 25: CSV Import

## 25.1 Overview

Import organizations, people, and opportunities from CSV files with column mapping and duplicate detection.

## 25.2 Import Flow

```
Step 1: Upload
┌─────────────────────────────────────────────────────────────────────────────┐
│ Import Organizations                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │                    📄 Drop CSV file here                                │ │
│ │                       or click to browse                                │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Download: [Sample CSV Template]                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Step 2: Map Columns
┌─────────────────────────────────────────────────────────────────────────────┐
│ Map Columns                                               150 rows detected │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ CSV Column              →    CRM Field                                      │
│ ─────────────────────────────────────────────────────────────────────────── │
│ Company Name            →    [Name ▼]                    ✓ Required         │
│ Website URL             →    [Website ▼]                                    │
│ City                    →    [Jurisdiction ▼]                               │
│ Type                    →    [Type ▼]                                       │
│ Annual Revenue          →    [annual_budget (custom) ▼]                     │
│ Contact Email           →    [— Skip this column — ▼]                       │
│                                                                             │
│ ☑️ First row is header                                                      │
│                                                                             │
│                                              [Back]  [Preview Import]       │
└─────────────────────────────────────────────────────────────────────────────┘

Step 3: Preview & Confirm
┌─────────────────────────────────────────────────────────────────────────────┐
│ Preview Import                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ 142 rows will be imported                                                │
│ ⚠️  5 potential duplicates found                                            │
│ ❌  3 rows have validation errors                                           │
│                                                                             │
│ DUPLICATES                                                    [View All]    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ "Portland Water" matches "Portland Water Bureau"                        │ │
│ │ [○ Skip  ● Import anyway  ○ Merge]                                      │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ "Seattle Utils" matches "Seattle Public Utilities"                      │ │
│ │ [● Skip  ○ Import anyway  ○ Merge]                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ERRORS                                                        [View All]    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Row 45: Missing required field "Name"                                   │ │
│ │ Row 89: Invalid URL format for "Website"                                │ │
│ │ Row 112: "Type" value "xyz" not in allowed options                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                              [Back]  [Import 142 Rows]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 25.3 Import Job Schema

```sql
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  
  entity_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- File info
  file_name TEXT NOT NULL,
  file_size INTEGER,
  
  -- Mapping
  column_mapping JSONB NOT NULL,  -- { "CSV Column": "crm_field" }
  
  -- Results
  total_rows INTEGER,
  imported_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB,  -- [{ row: 45, field: "name", error: "Required" }]
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

# Section 26: Duplicate Detection

## 26.1 Overview

Automatically detect potential duplicates when creating or importing records.

## 26.2 Detection Rules

| Entity | Match Criteria | Confidence |
|--------|----------------|------------|
| Organization | Exact name match | 100% |
| Organization | Fuzzy name (Levenshtein < 3) | 80% |
| Organization | Same domain | 90% |
| Person | Same email | 100% |
| Person | Same name + same org | 90% |
| Person | Same phone | 95% |

## 26.3 Implementation

```sql
CREATE OR REPLACE FUNCTION find_duplicate_organizations(
  p_project_id UUID,
  p_name TEXT,
  p_website TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  website TEXT,
  match_type TEXT,
  confidence INTEGER
) AS $$
BEGIN
  RETURN QUERY
  
  -- Exact name match
  SELECT o.id, o.name, o.website, 'exact_name'::TEXT, 100
  FROM organizations o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND LOWER(o.name) = LOWER(p_name)
  
  UNION
  
  -- Fuzzy name match
  SELECT o.id, o.name, o.website, 'similar_name'::TEXT, 80
  FROM organizations o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND LOWER(o.name) != LOWER(p_name)
    AND levenshtein(LOWER(o.name), LOWER(p_name)) <= 3
  
  UNION
  
  -- Domain match
  SELECT o.id, o.name, o.website, 'same_domain'::TEXT, 90
  FROM organizations o
  WHERE o.project_id = p_project_id
    AND o.deleted_at IS NULL
    AND p_website IS NOT NULL
    AND o.website IS NOT NULL
    AND extract_domain(o.website) = extract_domain(p_website)
  
  ORDER BY confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to extract domain
CREATE OR REPLACE FUNCTION extract_domain(url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(
    regexp_replace(url, '^https?://(www\.)?', ''),
    '/.*$', ''
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

# Section 27: Milestones (Updated)

## Phase 1: Foundation (Weeks 1-4)
- [ ] Project structure + auth
- [ ] Multi-tenancy + RLS
- [ ] Theme system (dark/light)
- [ ] Basic navigation

## Phase 2: Core Entities (Weeks 5-8)
- [ ] Organizations CRUD
- [ ] People CRUD
- [ ] Opportunities CRUD
- [ ] RFPs CRUD

## Phase 3: Dynamic Schema (Weeks 9-11)
- [ ] Field definitions CRUD
- [ ] Database column management
- [ ] Destructive delete with confirmation
- [ ] Dynamic form rendering

## Phase 4: AI Research (Weeks 12-14)
- [ ] OpenRouter integration
- [ ] Research with custom fields
- [ ] Research versioning
- [ ] Confidence thresholds

## Phase 5: Enrichment (Weeks 15-16)
- [ ] FullEnrich integration
- [ ] Webhook handling
- [ ] Enrichment status tracking

## Phase 6: Gmail + Sequences (Weeks 17-21)
- [ ] Gmail OAuth
- [ ] Send emails
- [ ] Tracking (open/click/reply)
- [ ] Sequences builder
- [ ] Sequence execution

## Phase 7: Must-Haves (Weeks 22-26)
- [ ] Dashboard
- [ ] Tasks & reminders
- [ ] Global search
- [ ] Notes
- [ ] Tags
- [ ] Email templates
- [ ] Notifications
- [ ] CSV import
- [ ] Duplicate detection

## Phase 8: Hardening (Weeks 27-28)
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation
- [ ] Production deploy

---

# Section 28: Definition of Done (v2.3)

All items from v2.2, plus:

**Dashboard & Core Features**
- [ ] Dashboard shows pipeline, tasks, research health, RFPs, activity
- [ ] Tasks can be created, assigned, completed with due dates
- [ ] Global search finds all entity types with keyboard navigation (⌘K)
- [ ] Notes can be added to any entity with markdown support
- [ ] Tags can be created and applied to any entity
- [ ] Email templates work for one-off sends with variable substitution
- [ ] Notifications appear in-app and optionally via email
- [ ] CSV import works with column mapping and validation
- [ ] Duplicate detection warns on create/import

**Dynamic Schema (JSONB Storage)**
- [ ] Custom fields stored in `custom_fields` JSONB column per entity
- [ ] Field definitions CRUD via Schema Manager GUI
- [ ] Each project's custom fields are completely isolated
- [ ] No DDL (ALTER TABLE) required at runtime
- [ ] Field deletion requires typing "DELETE {field_name}" confirmation
- [ ] Deleted field data removed from JSONB column
- [ ] Schema audit log tracks all field changes
- [ ] Dynamic forms render custom fields based on definitions
- [ ] Custom field values saved/loaded from JSONB

**AI Integration**
- [ ] AI research prompts include project's custom field definitions
- [ ] AI extraction hints guide the model
- [ ] Per-field confidence thresholds control auto-fill
- [ ] Low-confidence results flagged for user review
- [ ] Results saved: system fields to columns, custom fields to JSONB

---

*This PRD is the authoritative specification for GoodRev CRM v2.3.*
