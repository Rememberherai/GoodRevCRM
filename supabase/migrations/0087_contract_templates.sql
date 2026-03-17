-- Migration 0087: Contract templates table
-- Stores reusable document templates with field definitions and roles

CREATE TABLE IF NOT EXISTS public.contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    merge_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS: any project member can SELECT
CREATE POLICY "contract_templates_select" ON public.contract_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_templates.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- RLS: project members can INSERT
CREATE POLICY "contract_templates_insert" ON public.contract_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_templates.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- RLS: project members can UPDATE
CREATE POLICY "contract_templates_update" ON public.contract_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_templates.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- RLS: project members can DELETE
CREATE POLICY "contract_templates_delete" ON public.contract_templates
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_templates.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_templates_project_id ON public.contract_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_deleted_at ON public.contract_templates(deleted_at) WHERE deleted_at IS NULL;

-- Trigger
CREATE TRIGGER set_contract_templates_updated_at
    BEFORE UPDATE ON public.contract_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
