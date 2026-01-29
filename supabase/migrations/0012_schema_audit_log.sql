-- Migration 012: Schema audit log table
-- Tracks changes to custom field definitions for auditing and potential rollback

CREATE TYPE public.schema_change_type AS ENUM (
    'field_created',
    'field_updated',
    'field_deleted',
    'field_data_removed'
);

CREATE TABLE IF NOT EXISTS public.schema_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- What changed
    change_type public.schema_change_type NOT NULL,
    entity_type public.entity_type NOT NULL,
    field_name TEXT NOT NULL,
    field_id UUID,  -- Reference to the field (null if deleted)

    -- Change details
    old_value JSONB,  -- Previous state of the field definition
    new_value JSONB,  -- New state of the field definition

    -- For data removal tracking
    records_affected INTEGER,
    data_backup JSONB,  -- Backup of removed data (limited to first 1000 records)

    -- Who made the change
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Optional notes
    notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.schema_audit_log ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schema_audit_log_project_id ON public.schema_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_schema_audit_log_entity_type ON public.schema_audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_schema_audit_log_field_name ON public.schema_audit_log(field_name);
CREATE INDEX IF NOT EXISTS idx_schema_audit_log_performed_at ON public.schema_audit_log(performed_at);

-- RLS Policies

-- Admins can view schema audit logs
CREATE POLICY "Admins can view schema audit logs"
    ON public.schema_audit_log
    FOR SELECT
    USING (
        public.has_project_role(project_id, 'admin')
    );

-- Only the system can insert audit logs (via functions)
-- No direct insert policy - inserts happen through security definer functions

-- Comments
COMMENT ON TABLE public.schema_audit_log IS 'Audit trail for custom field schema changes';
COMMENT ON COLUMN public.schema_audit_log.data_backup IS 'Backup of removed custom field data (limited to 1000 records)';
