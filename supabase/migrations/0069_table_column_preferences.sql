-- Migration 069: Table column preferences
-- Stores per-user, per-project, per-entity preferences for table column visibility and ordering

CREATE TABLE IF NOT EXISTS public.table_column_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entity_type public.entity_type NOT NULL,

    -- Column configuration stored as JSONB array
    -- Each element: { "key": "column_key", "visible": true, "order": 0, "width": 150 }
    columns JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one preference record per user/project/entity combination
    CONSTRAINT unique_column_preference UNIQUE (project_id, user_id, entity_type)
);

-- Enable Row Level Security
ALTER TABLE public.table_column_preferences ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_table_column_preferences_updated_at
    BEFORE UPDATE ON public.table_column_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_table_column_preferences_user
    ON public.table_column_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_table_column_preferences_project_entity
    ON public.table_column_preferences(project_id, entity_type);

-- RLS Policies: Users can only access their own preferences

-- Users can view their own column preferences
CREATE POLICY "Users can view their own column preferences"
    ON public.table_column_preferences
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own column preferences
CREATE POLICY "Users can insert their own column preferences"
    ON public.table_column_preferences
    FOR INSERT
    WITH CHECK (user_id = auth.uid() AND public.is_project_member(project_id));

-- Users can update their own column preferences
CREATE POLICY "Users can update their own column preferences"
    ON public.table_column_preferences
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own column preferences
CREATE POLICY "Users can delete their own column preferences"
    ON public.table_column_preferences
    FOR DELETE
    USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE public.table_column_preferences IS 'Stores user preferences for table column visibility and ordering per entity type';
COMMENT ON COLUMN public.table_column_preferences.columns IS 'JSONB array of column configurations with key, visible, order, and optional width';
