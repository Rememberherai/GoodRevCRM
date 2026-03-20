-- Migration 0130: Dispositions for Organizations & People
-- User-configurable status categories (Prospect, Customer, Partner, etc.)
-- NOTE: Idempotent — objects may already exist from a prior push

CREATE TABLE IF NOT EXISTS public.dispositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Disposition fields
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'gray',
    entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'person')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.dispositions ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_dispositions_updated_at ON public.dispositions;
CREATE TRIGGER set_dispositions_updated_at
    BEFORE UPDATE ON public.dispositions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dispositions_project_id ON public.dispositions(project_id);
CREATE INDEX IF NOT EXISTS idx_dispositions_deleted_at ON public.dispositions(deleted_at) WHERE deleted_at IS NULL;

-- Name uniqueness per project + entity_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispositions_project_entity_name
    ON public.dispositions(project_id, entity_type, name)
    WHERE deleted_at IS NULL;

-- RLS Policies (drop + recreate for idempotency)
DROP POLICY IF EXISTS "Members can view project dispositions" ON public.dispositions;
CREATE POLICY "Members can view project dispositions"
    ON public.dispositions
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

DROP POLICY IF EXISTS "Members can create dispositions" ON public.dispositions;
CREATE POLICY "Members can create dispositions"
    ON public.dispositions
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

DROP POLICY IF EXISTS "Members can update dispositions" ON public.dispositions;
CREATE POLICY "Members can update dispositions"
    ON public.dispositions
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

DROP POLICY IF EXISTS "Members can delete dispositions" ON public.dispositions;
CREATE POLICY "Members can delete dispositions"
    ON public.dispositions
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Add disposition_id FK to organizations and people
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS disposition_id UUID REFERENCES public.dispositions(id) ON DELETE SET NULL;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS disposition_id UUID REFERENCES public.dispositions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_disposition_id ON public.organizations(disposition_id);
CREATE INDEX IF NOT EXISTS idx_people_disposition_id ON public.people(disposition_id);

-- Comments
COMMENT ON TABLE public.dispositions IS 'User-configurable status categories for organizations and people';
COMMENT ON COLUMN public.dispositions.entity_type IS 'Which entity type this disposition applies to: organization or person';
COMMENT ON COLUMN public.dispositions.color IS 'Badge color: gray, blue, green, red, yellow, purple, orange, pink';
COMMENT ON COLUMN public.dispositions.is_default IS 'Auto-assigned to new records when no disposition specified';
COMMENT ON COLUMN public.dispositions.sort_order IS 'Display order in dropdowns and settings';
