-- Migration 009: RFPs table
-- Request for Proposal tracking with deadline management and custom fields

CREATE TYPE public.rfp_status AS ENUM (
    'identified',
    'reviewing',
    'preparing',
    'submitted',
    'won',
    'lost',
    'no_bid'
);

CREATE TABLE IF NOT EXISTS public.rfps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

    -- Core RFP fields
    title TEXT NOT NULL,
    description TEXT,
    status public.rfp_status NOT NULL DEFAULT 'identified',
    rfp_number TEXT,  -- External RFP reference number

    -- Related entities
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Important dates
    issue_date DATE,
    due_date TIMESTAMPTZ,
    questions_due_date TIMESTAMPTZ,
    decision_date DATE,

    -- Financial
    estimated_value DECIMAL(15, 2),
    currency TEXT DEFAULT 'USD',
    budget_range TEXT,

    -- Submission details
    submission_method TEXT,  -- 'email', 'portal', 'physical', 'other'
    submission_portal_url TEXT,
    submission_email TEXT,
    submission_instructions TEXT,

    -- Evaluation
    win_probability INTEGER CHECK (win_probability >= 0 AND win_probability <= 100),
    go_no_go_decision TEXT,  -- 'go', 'no_go', 'pending'
    go_no_go_date DATE,
    go_no_go_notes TEXT,

    -- Outcome
    outcome_reason TEXT,
    feedback TEXT,
    awarded_to TEXT,  -- If lost, who won

    -- Documents and links
    rfp_document_url TEXT,
    response_document_url TEXT,

    -- Custom fields stored as JSONB
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.rfps ENABLE ROW LEVEL SECURITY;

-- Apply updated_at trigger
CREATE TRIGGER set_rfps_updated_at
    BEFORE UPDATE ON public.rfps
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfps_project_id ON public.rfps(project_id);
CREATE INDEX IF NOT EXISTS idx_rfps_status ON public.rfps(status);
CREATE INDEX IF NOT EXISTS idx_rfps_organization_id ON public.rfps(organization_id);
CREATE INDEX IF NOT EXISTS idx_rfps_opportunity_id ON public.rfps(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_rfps_owner_id ON public.rfps(owner_id);
CREATE INDEX IF NOT EXISTS idx_rfps_due_date ON public.rfps(due_date);
CREATE INDEX IF NOT EXISTS idx_rfps_deleted_at ON public.rfps(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rfps_custom_fields ON public.rfps USING gin(custom_fields);

-- RLS Policies

-- Members can view RFPs in their projects
CREATE POLICY "Members can view project rfps"
    ON public.rfps
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(project_id)
    );

-- Members can create RFPs
CREATE POLICY "Members can create rfps"
    ON public.rfps
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can update RFPs
CREATE POLICY "Members can update rfps"
    ON public.rfps
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'member')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'member')
    );

-- Members can delete (soft delete) RFPs
CREATE POLICY "Members can delete rfps"
    ON public.rfps
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'member')
    );

-- Comments
COMMENT ON TABLE public.rfps IS 'Request for Proposal tracking';
COMMENT ON COLUMN public.rfps.rfp_number IS 'External reference number from the issuing organization';
COMMENT ON COLUMN public.rfps.go_no_go_decision IS 'Decision on whether to bid on this RFP';
