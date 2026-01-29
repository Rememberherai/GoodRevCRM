-- Migration 011: Custom field definitions table
-- Defines the schema for dynamic custom fields per entity type

CREATE TYPE public.entity_type AS ENUM ('organization', 'person', 'opportunity', 'rfp');

CREATE TYPE public.field_type AS ENUM (
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
    'user'  -- Reference to a user in the project
);

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    entity_type public.entity_type NOT NULL,

    -- Field definition
    name TEXT NOT NULL,  -- Internal name (snake_case, used as JSONB key)
    label TEXT NOT NULL,  -- Display label
    description TEXT,
    field_type public.field_type NOT NULL,

    -- Field configuration
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_unique BOOLEAN NOT NULL DEFAULT FALSE,
    is_searchable BOOLEAN NOT NULL DEFAULT TRUE,
    is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
    is_visible_in_list BOOLEAN NOT NULL DEFAULT TRUE,

    -- Display order
    display_order INTEGER NOT NULL DEFAULT 0,
    group_name TEXT,  -- For grouping fields in forms

    -- Type-specific options stored as JSONB
    -- For select/multi_select: { "options": [{"value": "opt1", "label": "Option 1", "color": "#hex"}] }
    -- For number/currency/percentage: { "min": 0, "max": 100, "precision": 2 }
    -- For text/textarea: { "min_length": 0, "max_length": 500, "placeholder": "..." }
    -- For date/datetime: { "min_date": "2020-01-01", "max_date": "2030-12-31" }
    -- For rating: { "max": 5 }
    options JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Default value (stored as JSONB to handle all types)
    default_value JSONB,

    -- Validation rules (stored as JSONB)
    -- { "pattern": "regex", "custom_message": "Error message" }
    validation_rules JSONB,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique field names per project and entity type
    CONSTRAINT unique_field_name_per_entity UNIQUE (project_id, entity_type, name)
);

-- Enable Row Level Security
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_custom_field_definitions_updated_at
    BEFORE UPDATE ON public.custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_project_id ON public.custom_field_definitions(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_entity_type ON public.custom_field_definitions(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_display_order ON public.custom_field_definitions(project_id, entity_type, display_order);

-- RLS Policies

-- All project members can view custom field definitions
CREATE POLICY "Members can view custom field definitions"
    ON public.custom_field_definitions
    FOR SELECT
    USING (
        public.is_project_member(project_id)
    );

-- Admins can create custom field definitions
CREATE POLICY "Admins can create custom field definitions"
    ON public.custom_field_definitions
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'admin')
    );

-- Admins can update custom field definitions
CREATE POLICY "Admins can update custom field definitions"
    ON public.custom_field_definitions
    FOR UPDATE
    USING (
        public.has_project_role(project_id, 'admin')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'admin')
    );

-- Admins can delete custom field definitions
CREATE POLICY "Admins can delete custom field definitions"
    ON public.custom_field_definitions
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'admin')
    );

-- Comments
COMMENT ON TABLE public.custom_field_definitions IS 'Definitions for dynamic custom fields per entity type';
COMMENT ON COLUMN public.custom_field_definitions.name IS 'Internal field name used as JSONB key (snake_case)';
COMMENT ON COLUMN public.custom_field_definitions.label IS 'Human-readable display label';
COMMENT ON COLUMN public.custom_field_definitions.options IS 'Type-specific configuration options';
