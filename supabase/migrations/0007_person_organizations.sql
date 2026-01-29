-- Migration 007: Person-Organization junction table
-- Links people to organizations with role and status tracking

CREATE TABLE IF NOT EXISTS public.person_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Relationship details
    job_title TEXT,
    department TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE,
    end_date DATE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique person-org relationship per project
    CONSTRAINT unique_person_org UNIQUE (person_id, organization_id)
);

-- Enable Row Level Security
ALTER TABLE public.person_organizations ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_person_organizations_updated_at
    BEFORE UPDATE ON public.person_organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_organizations_person_id ON public.person_organizations(person_id);
CREATE INDEX IF NOT EXISTS idx_person_organizations_organization_id ON public.person_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_person_organizations_project_id ON public.person_organizations(project_id);
CREATE INDEX IF NOT EXISTS idx_person_organizations_is_primary ON public.person_organizations(is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_person_organizations_is_current ON public.person_organizations(is_current) WHERE is_current = TRUE;

-- RLS Policies

-- Members can view person-org links in their projects
CREATE POLICY "Members can view person-org links"
    ON public.person_organizations
    FOR SELECT
    USING (
        public.is_project_member(project_id)
    );

-- Members can create person-org links
CREATE POLICY "Members can create person-org links"
    ON public.person_organizations
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can update person-org links
CREATE POLICY "Members can update person-org links"
    ON public.person_organizations
    FOR UPDATE
    USING (
        public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can delete person-org links
CREATE POLICY "Members can delete person-org links"
    ON public.person_organizations
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Function to ensure only one primary organization per person
CREATE OR REPLACE FUNCTION public.ensure_single_primary_org()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = TRUE THEN
        -- Unset any existing primary organization for this person
        UPDATE public.person_organizations
        SET is_primary = FALSE
        WHERE person_id = NEW.person_id
        AND id != NEW.id
        AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_primary_org_trigger
    BEFORE INSERT OR UPDATE ON public.person_organizations
    FOR EACH ROW
    WHEN (NEW.is_primary = TRUE)
    EXECUTE FUNCTION public.ensure_single_primary_org();

-- Comments
COMMENT ON TABLE public.person_organizations IS 'Junction table linking people to organizations';
COMMENT ON COLUMN public.person_organizations.is_primary IS 'Whether this is the persons primary organization';
COMMENT ON COLUMN public.person_organizations.is_current IS 'Whether the person currently works at this organization';
