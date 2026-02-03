-- Migration 035: Add AI research fields to custom_field_definitions
-- Allows users to configure AI extraction settings per custom field

-- Add AI-related columns to custom_field_definitions
ALTER TABLE public.custom_field_definitions
ADD COLUMN IF NOT EXISTS is_ai_extractable BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_extraction_hint TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence_threshold NUMERIC(3,2) DEFAULT 0.7 CHECK (ai_confidence_threshold >= 0 AND ai_confidence_threshold <= 1);

-- Add comments
COMMENT ON COLUMN public.custom_field_definitions.is_ai_extractable IS 'Whether AI research should attempt to extract this field';
COMMENT ON COLUMN public.custom_field_definitions.ai_extraction_hint IS 'Instructions for AI on how to find/extract this field value';
COMMENT ON COLUMN public.custom_field_definitions.ai_confidence_threshold IS 'Minimum confidence (0-1) required for auto-applying AI results';

-- Create table for project-level research settings
CREATE TABLE IF NOT EXISTS public.research_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    entity_type public.entity_type NOT NULL,

    -- Custom prompt templates
    system_prompt TEXT,
    user_prompt_template TEXT,

    -- Model settings
    model_id TEXT DEFAULT 'anthropic/claude-3.5-sonnet',
    temperature NUMERIC(2,1) DEFAULT 0.3 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 4096,

    -- Default confidence threshold
    default_confidence_threshold NUMERIC(3,2) DEFAULT 0.7 CHECK (default_confidence_threshold >= 0 AND default_confidence_threshold <= 1),

    -- Auto-apply settings
    auto_apply_high_confidence BOOLEAN DEFAULT TRUE,
    high_confidence_threshold NUMERIC(3,2) DEFAULT 0.85 CHECK (high_confidence_threshold >= 0 AND high_confidence_threshold <= 1),

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One setting per entity type per project
    CONSTRAINT unique_research_settings UNIQUE (project_id, entity_type)
);

-- Enable RLS
ALTER TABLE public.research_settings ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_research_settings_updated_at ON public.research_settings;
CREATE TRIGGER set_research_settings_updated_at
    BEFORE UPDATE ON public.research_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
DROP POLICY IF EXISTS "Members can view research settings" ON public.research_settings;
CREATE POLICY "Members can view research settings"
    ON public.research_settings
    FOR SELECT
    USING (public.is_project_member(project_id));

DROP POLICY IF EXISTS "Admins can manage research settings" ON public.research_settings;
CREATE POLICY "Admins can manage research settings"
    ON public.research_settings
    FOR ALL
    USING (public.has_project_role(project_id, 'admin'))
    WITH CHECK (public.has_project_role(project_id, 'admin'));

-- Create index
CREATE INDEX IF NOT EXISTS idx_research_settings_project_entity ON public.research_settings(project_id, entity_type);

-- Comments
COMMENT ON TABLE public.research_settings IS 'Project-level AI research configuration per entity type';
COMMENT ON COLUMN public.research_settings.system_prompt IS 'Custom system prompt for AI research';
COMMENT ON COLUMN public.research_settings.user_prompt_template IS 'Custom user prompt template with placeholders';
