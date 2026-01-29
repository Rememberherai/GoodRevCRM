-- Migration 006: People table
-- Contact/person records in the CRM with custom fields support

CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- System fields (core data columns)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile_phone TEXT,
    job_title TEXT,
    department TEXT,
    linkedin_url TEXT,
    twitter_handle TEXT,
    avatar_url TEXT,
    timezone TEXT,
    preferred_contact_method TEXT,
    notes TEXT,

    -- Address fields
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal_code TEXT,
    address_country TEXT,

    -- Email enrichment data (from FullEnrich)
    enrichment_status TEXT, -- 'pending', 'completed', 'failed', 'not_started'
    enriched_at TIMESTAMPTZ,
    enrichment_data JSONB,

    -- Custom fields stored as JSONB
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_people_updated_at
    BEFORE UPDATE ON public.people
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_people_project_id ON public.people(project_id);
CREATE INDEX IF NOT EXISTS idx_people_email ON public.people(email);
CREATE INDEX IF NOT EXISTS idx_people_name ON public.people(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_people_deleted_at ON public.people(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_people_custom_fields ON public.people USING gin(custom_fields);
CREATE INDEX IF NOT EXISTS idx_people_enrichment_status ON public.people(enrichment_status);

-- RLS Policies

-- Members can view people in their projects
CREATE POLICY "Members can view project people"
    ON public.people
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

-- Members can create people
CREATE POLICY "Members can create people"
    ON public.people
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can update people
CREATE POLICY "Members can update people"
    ON public.people
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can delete (soft delete) people
CREATE POLICY "Members can delete people"
    ON public.people
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Comments
COMMENT ON TABLE public.people IS 'Contact and person records in the CRM';
COMMENT ON COLUMN public.people.custom_fields IS 'Dynamic custom fields stored as JSONB';
COMMENT ON COLUMN public.people.enrichment_data IS 'Data returned from FullEnrich API';
