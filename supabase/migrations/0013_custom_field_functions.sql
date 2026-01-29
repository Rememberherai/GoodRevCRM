-- Migration 013: Custom field management functions
-- Functions for safely managing custom fields and their data

-- Function to remove custom field data from all records when a field is deleted
-- This is called when a custom field definition is deleted
CREATE OR REPLACE FUNCTION public.remove_custom_field_data(
    p_project_id UUID,
    p_entity_type public.entity_type,
    p_field_name TEXT,
    p_field_id UUID,
    p_performed_by UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_table_name TEXT;
    v_records_affected INTEGER := 0;
    v_data_backup JSONB;
    v_sql TEXT;
BEGIN
    -- Determine the table based on entity type
    v_table_name := CASE p_entity_type
        WHEN 'organization' THEN 'organizations'
        WHEN 'person' THEN 'people'
        WHEN 'opportunity' THEN 'opportunities'
        WHEN 'rfp' THEN 'rfps'
    END;

    -- Count affected records
    EXECUTE format(
        'SELECT COUNT(*) FROM public.%I WHERE project_id = $1 AND custom_fields ? $2',
        v_table_name
    ) INTO v_records_affected USING p_project_id, p_field_name;

    -- Backup data from first 1000 records (for potential recovery)
    EXECUTE format(
        'SELECT jsonb_agg(jsonb_build_object(''id'', id, ''value'', custom_fields->$2))
         FROM (SELECT id, custom_fields FROM public.%I
               WHERE project_id = $1 AND custom_fields ? $2
               LIMIT 1000) sub',
        v_table_name
    ) INTO v_data_backup USING p_project_id, p_field_name;

    -- Log the change before removing data
    INSERT INTO public.schema_audit_log (
        project_id,
        change_type,
        entity_type,
        field_name,
        field_id,
        records_affected,
        data_backup,
        performed_by,
        notes
    ) VALUES (
        p_project_id,
        'field_data_removed',
        p_entity_type,
        p_field_name,
        p_field_id,
        v_records_affected,
        v_data_backup,
        p_performed_by,
        format('Removed field "%s" data from %s records', p_field_name, v_records_affected)
    );

    -- Remove the field from all records
    EXECUTE format(
        'UPDATE public.%I SET custom_fields = custom_fields - $2 WHERE project_id = $1 AND custom_fields ? $2',
        v_table_name
    ) USING p_project_id, p_field_name;

    RETURN v_records_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to log field creation
CREATE OR REPLACE FUNCTION public.log_field_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.schema_audit_log (
        project_id,
        change_type,
        entity_type,
        field_name,
        field_id,
        new_value,
        performed_by
    ) VALUES (
        NEW.project_id,
        'field_created',
        NEW.entity_type,
        NEW.name,
        NEW.id,
        to_jsonb(NEW),
        NEW.created_by
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_custom_field_created
    AFTER INSERT ON public.custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_field_created();

-- Trigger function to log field updates
CREATE OR REPLACE FUNCTION public.log_field_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if something actually changed (not just updated_at)
    IF OLD.name IS DISTINCT FROM NEW.name
       OR OLD.label IS DISTINCT FROM NEW.label
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.field_type IS DISTINCT FROM NEW.field_type
       OR OLD.is_required IS DISTINCT FROM NEW.is_required
       OR OLD.options IS DISTINCT FROM NEW.options
       OR OLD.default_value IS DISTINCT FROM NEW.default_value
       OR OLD.validation_rules IS DISTINCT FROM NEW.validation_rules
    THEN
        INSERT INTO public.schema_audit_log (
            project_id,
            change_type,
            entity_type,
            field_name,
            field_id,
            old_value,
            new_value,
            performed_by
        ) VALUES (
            NEW.project_id,
            'field_updated',
            NEW.entity_type,
            NEW.name,
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW),
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_custom_field_updated
    AFTER UPDATE ON public.custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_field_updated();

-- Trigger function to log field deletion and remove data
CREATE OR REPLACE FUNCTION public.log_field_deleted()
RETURNS TRIGGER AS $$
DECLARE
    v_records_affected INTEGER;
BEGIN
    -- First, remove the data from all records
    v_records_affected := public.remove_custom_field_data(
        OLD.project_id,
        OLD.entity_type,
        OLD.name,
        OLD.id,
        auth.uid()
    );

    -- Log the deletion
    INSERT INTO public.schema_audit_log (
        project_id,
        change_type,
        entity_type,
        field_name,
        field_id,
        old_value,
        performed_by,
        notes
    ) VALUES (
        OLD.project_id,
        'field_deleted',
        OLD.entity_type,
        OLD.name,
        OLD.id,
        to_jsonb(OLD),
        auth.uid(),
        format('Field deleted, %s records had data removed', v_records_affected)
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_custom_field_deleted
    BEFORE DELETE ON public.custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_field_deleted();

-- Function to validate custom field data against its definition
CREATE OR REPLACE FUNCTION public.validate_custom_field(
    p_field_def public.custom_field_definitions,
    p_value JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_options JSONB;
BEGIN
    -- Null values are valid unless field is required
    IF p_value IS NULL OR p_value = 'null'::jsonb THEN
        RETURN NOT p_field_def.is_required;
    END IF;

    -- Type-specific validation
    CASE p_field_def.field_type
        WHEN 'text', 'textarea' THEN
            IF jsonb_typeof(p_value) != 'string' THEN
                RETURN FALSE;
            END IF;
            v_options := p_field_def.options;
            IF v_options ? 'max_length' AND length(p_value #>> '{}') > (v_options->>'max_length')::integer THEN
                RETURN FALSE;
            END IF;

        WHEN 'number', 'currency', 'percentage' THEN
            IF jsonb_typeof(p_value) != 'number' THEN
                RETURN FALSE;
            END IF;
            v_options := p_field_def.options;
            IF v_options ? 'min' AND (p_value)::numeric < (v_options->>'min')::numeric THEN
                RETURN FALSE;
            END IF;
            IF v_options ? 'max' AND (p_value)::numeric > (v_options->>'max')::numeric THEN
                RETURN FALSE;
            END IF;

        WHEN 'boolean' THEN
            IF jsonb_typeof(p_value) != 'boolean' THEN
                RETURN FALSE;
            END IF;

        WHEN 'date', 'datetime' THEN
            IF jsonb_typeof(p_value) != 'string' THEN
                RETURN FALSE;
            END IF;
            -- Basic date format check (ISO 8601)
            BEGIN
                PERFORM (p_value #>> '{}')::timestamptz;
            EXCEPTION WHEN OTHERS THEN
                RETURN FALSE;
            END;

        WHEN 'select' THEN
            IF jsonb_typeof(p_value) != 'string' THEN
                RETURN FALSE;
            END IF;
            v_options := p_field_def.options;
            IF v_options ? 'options' THEN
                IF NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(v_options->'options') opt
                    WHERE opt->>'value' = p_value #>> '{}'
                ) THEN
                    RETURN FALSE;
                END IF;
            END IF;

        WHEN 'multi_select' THEN
            IF jsonb_typeof(p_value) != 'array' THEN
                RETURN FALSE;
            END IF;

        WHEN 'url' THEN
            IF jsonb_typeof(p_value) != 'string' THEN
                RETURN FALSE;
            END IF;
            -- Basic URL format check
            IF NOT (p_value #>> '{}') ~* '^https?://' THEN
                RETURN FALSE;
            END IF;

        WHEN 'email' THEN
            IF jsonb_typeof(p_value) != 'string' THEN
                RETURN FALSE;
            END IF;
            -- Basic email format check
            IF NOT (p_value #>> '{}') ~* '^[^@]+@[^@]+\.[^@]+$' THEN
                RETURN FALSE;
            END IF;

        WHEN 'rating' THEN
            IF jsonb_typeof(p_value) != 'number' THEN
                RETURN FALSE;
            END IF;
            v_options := p_field_def.options;
            IF (p_value)::integer < 0 OR (p_value)::integer > COALESCE((v_options->>'max')::integer, 5) THEN
                RETURN FALSE;
            END IF;

        ELSE
            -- For other types, accept any value
            RETURN TRUE;
    END CASE;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments
COMMENT ON FUNCTION public.remove_custom_field_data IS 'Removes custom field data from all entity records when a field is deleted';
COMMENT ON FUNCTION public.validate_custom_field IS 'Validates a custom field value against its definition';
