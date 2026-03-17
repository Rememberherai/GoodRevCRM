-- Migration 0088: Contract documents table
-- Core table for e-signature documents with full lifecycle tracking

CREATE TABLE IF NOT EXISTS public.contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','sent','viewed','partially_signed','completed','declined','expired','voided')),

    -- Files (Supabase Storage paths)
    original_file_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    original_file_hash TEXT,
    signed_file_path TEXT,
    signed_file_hash TEXT,
    certificate_file_path TEXT,
    page_count INTEGER NOT NULL DEFAULT 1,

    -- Relationships
    template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,

    -- Gmail connection (soft reference, no FK)
    gmail_connection_id UUID,
    sender_email TEXT,
    CONSTRAINT chk_sender_on_send CHECK (
        status = 'draft' OR (sender_email IS NOT NULL AND gmail_connection_id IS NOT NULL)
    ),

    -- Workflow
    signing_order_type TEXT NOT NULL DEFAULT 'sequential'
        CHECK (signing_order_type IN ('sequential', 'parallel')),
    current_signing_group INTEGER DEFAULT 1,

    -- Lifecycle timestamps
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    receipt_sent_at TIMESTAMPTZ,

    -- Reminders
    reminder_enabled BOOLEAN NOT NULL DEFAULT true,
    reminder_interval_days INTEGER DEFAULT 3,
    last_reminder_at TIMESTAMPTZ,

    -- Ownership
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

-- RLS: any project member can SELECT
CREATE POLICY "contract_documents_select" ON public.contract_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_documents_insert" ON public.contract_documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_documents_update" ON public.contract_documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_documents_delete" ON public.contract_documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_documents.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_documents_project_id ON public.contract_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_status ON public.contract_documents(status);
CREATE INDEX IF NOT EXISTS idx_contract_documents_opportunity_id ON public.contract_documents(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_organization_id ON public.contract_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_person_id ON public.contract_documents(person_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_expires_at ON public.contract_documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_contract_documents_deleted_at ON public.contract_documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contract_documents_custom_fields ON public.contract_documents USING GIN (custom_fields);

-- Trigger
CREATE TRIGGER set_contract_documents_updated_at
    BEFORE UPDATE ON public.contract_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
