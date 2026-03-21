-- Migration 0137: Service Types lookup table
-- User-configurable service categories shared across jobs, contractors, and referrals.
-- NOTE: Idempotent — objects may already exist from a prior push

CREATE TABLE IF NOT EXISTS public.service_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Service type fields
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'gray',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS set_service_types_updated_at ON public.service_types;
CREATE TRIGGER set_service_types_updated_at
    BEFORE UPDATE ON public.service_types
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_types_project_id ON public.service_types(project_id);
CREATE INDEX IF NOT EXISTS idx_service_types_deleted_at ON public.service_types(deleted_at) WHERE deleted_at IS NULL;

-- Name uniqueness per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_types_project_name
    ON public.service_types(project_id, name)
    WHERE deleted_at IS NULL;

-- RLS Policies (drop + recreate for idempotency)
DROP POLICY IF EXISTS "Members can view project service types" ON public.service_types;
CREATE POLICY "Members can view project service types"
    ON public.service_types
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

DROP POLICY IF EXISTS "Members can create service types" ON public.service_types;
CREATE POLICY "Members can create service types"
    ON public.service_types
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

DROP POLICY IF EXISTS "Members can update service types" ON public.service_types;
CREATE POLICY "Members can update service types"
    ON public.service_types
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

DROP POLICY IF EXISTS "Members can delete service types" ON public.service_types;
CREATE POLICY "Members can delete service types"
    ON public.service_types
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Add service_type_id FK to jobs and referrals
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL;

-- Add service_type_ids array to contractor_scopes
ALTER TABLE public.contractor_scopes ADD COLUMN IF NOT EXISTS service_type_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_jobs_service_type_id ON public.jobs(service_type_id);
CREATE INDEX IF NOT EXISTS idx_referrals_service_type_id ON public.referrals(service_type_id);

-- Comments
COMMENT ON TABLE public.service_types IS 'User-configurable service categories shared across jobs, contractors, and referrals';
COMMENT ON COLUMN public.service_types.color IS 'Badge color: gray, blue, green, red, yellow, purple, orange, pink';
COMMENT ON COLUMN public.service_types.is_active IS 'Whether this service type is available for selection';
COMMENT ON COLUMN public.service_types.sort_order IS 'Display order in dropdowns and settings';
