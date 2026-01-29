-- Migration 008: Opportunities table
-- Sales opportunities/deals with pipeline tracking and custom fields

CREATE TYPE public.opportunity_stage AS ENUM (
    'prospecting',
    'qualification',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost'
);

CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Core opportunity fields
    name TEXT NOT NULL,
    description TEXT,
    stage public.opportunity_stage NOT NULL DEFAULT 'prospecting',
    amount DECIMAL(15, 2),
    currency TEXT DEFAULT 'USD',
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,

    -- Related entities
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    primary_contact_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Pipeline tracking
    stage_changed_at TIMESTAMPTZ,
    days_in_stage INTEGER DEFAULT 0,
    lost_reason TEXT,
    won_reason TEXT,
    competitor TEXT,

    -- Source tracking
    source TEXT,
    campaign TEXT,

    -- Custom fields stored as JSONB
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_opportunities_updated_at
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_project_id ON public.opportunities(project_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON public.opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_organization_id ON public.opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_id ON public.opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close_date ON public.opportunities(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_deleted_at ON public.opportunities(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_custom_fields ON public.opportunities USING gin(custom_fields);

-- RLS Policies

-- Members can view opportunities in their projects
CREATE POLICY "Members can view project opportunities"
    ON public.opportunities
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

-- Members can create opportunities
CREATE POLICY "Members can create opportunities"
    ON public.opportunities
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can update opportunities
CREATE POLICY "Members can update opportunities"
    ON public.opportunities
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can delete (soft delete) opportunities
CREATE POLICY "Members can delete opportunities"
    ON public.opportunities
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Function to track stage changes
CREATE OR REPLACE FUNCTION public.track_opportunity_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        NEW.stage_changed_at = NOW();
        NEW.days_in_stage = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_opportunity_stage_change_trigger
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW
    EXECUTE FUNCTION public.track_opportunity_stage_change();

-- Comments
COMMENT ON TABLE public.opportunities IS 'Sales opportunities and deals';
COMMENT ON COLUMN public.opportunities.stage IS 'Current stage in the sales pipeline';
COMMENT ON COLUMN public.opportunities.amount IS 'Deal value in specified currency';
COMMENT ON COLUMN public.opportunities.probability IS 'Probability of winning (0-100%)';
