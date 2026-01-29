-- Migration 005: Organizations table
-- Company/organization records in the CRM with custom fields support

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- System fields (core data columns)
    name TEXT NOT NULL,
    domain TEXT,
    website TEXT,
    industry TEXT,
    employee_count INTEGER,
    annual_revenue BIGINT,
    description TEXT,
    logo_url TEXT,
    linkedin_url TEXT,
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal_code TEXT,
    address_country TEXT,
    phone TEXT,

    -- Custom fields stored as JSONB
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_project_id ON public.organizations(project_id);
CREATE INDEX IF NOT EXISTS idx_organizations_name ON public.organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON public.organizations(domain);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON public.organizations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_custom_fields ON public.organizations USING gin(custom_fields);

-- RLS Policies

-- Members can view organizations in their projects
CREATE POLICY "Members can view project organizations"
    ON public.organizations
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

-- Members can create organizations
CREATE POLICY "Members can create organizations"
    ON public.organizations
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can update organizations
CREATE POLICY "Members can update organizations"
    ON public.organizations
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can delete (soft delete) organizations
CREATE POLICY "Members can delete organizations"
    ON public.organizations
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Comments
COMMENT ON TABLE public.organizations IS 'Company and organization records in the CRM';
COMMENT ON COLUMN public.organizations.custom_fields IS 'Dynamic custom fields stored as JSONB, validated against custom_field_definitions';
