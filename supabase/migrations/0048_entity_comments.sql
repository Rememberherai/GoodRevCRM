-- Migration 0048: Entity Comments
-- Comments on people, organizations, and opportunities for team collaboration
-- Supports @mentions with notification dispatch

CREATE TABLE IF NOT EXISTS public.entity_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('person', 'organization', 'opportunity')),
    entity_id UUID NOT NULL,
    content TEXT NOT NULL,
    mentions JSONB NOT NULL DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.entity_comments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_entity_comments_updated_at
    BEFORE UPDATE ON public.entity_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_entity_comments_entity ON public.entity_comments(entity_type, entity_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_entity_comments_project ON public.entity_comments(project_id);
CREATE INDEX idx_entity_comments_created_by ON public.entity_comments(created_by);

-- RLS Policies
CREATE POLICY "Members can view project entity_comments"
    ON public.entity_comments
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

CREATE POLICY "Members can create entity_comments"
    ON public.entity_comments
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

CREATE POLICY "Members can update own entity_comments"
    ON public.entity_comments
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND created_by = auth.uid()
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

CREATE POLICY "Members can delete own entity_comments"
    ON public.entity_comments
    FOR DELETE
    USING (
        created_by = auth.uid()
        AND public.has_project_role(project_id, 'member')
    );
