-- Migration 0089: Contract recipients table
-- Tracks signers, CC, and witnesses for each document

CREATE TABLE IF NOT EXISTS public.contract_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.contract_documents(id) ON DELETE CASCADE,

    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'signer' CHECK (role IN ('signer', 'cc', 'witness')),
    signing_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','sent','viewed','signed','declined','delegated')),

    -- Token for public signing page
    signing_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    token_expires_at TIMESTAMPTZ,

    -- Event timestamps
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    decline_reason TEXT,

    -- Delegation
    delegated_to_recipient_id UUID REFERENCES public.contract_recipients(id) ON DELETE SET NULL,
    delegated_at TIMESTAMPTZ,

    -- Legal capture (E-SIGN Act compliance)
    consent_ip TEXT,
    consent_user_agent TEXT,
    consent_timestamp TIMESTAMPTZ,
    signing_ip TEXT,
    signing_user_agent TEXT,

    -- Saved signature/initials data
    signature_data JSONB,
    initials_data JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contract_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_recipients_select" ON public.contract_recipients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_recipients_insert" ON public.contract_recipients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_recipients_update" ON public.contract_recipients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_recipients_delete" ON public.contract_recipients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_recipients.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_recipients_project_id ON public.contract_recipients(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_recipients_document_id ON public.contract_recipients(document_id);
CREATE INDEX IF NOT EXISTS idx_contract_recipients_email ON public.contract_recipients(email);
CREATE INDEX IF NOT EXISTS idx_contract_recipients_person_id ON public.contract_recipients(person_id);
CREATE INDEX IF NOT EXISTS idx_contract_recipients_status ON public.contract_recipients(status);

-- Trigger
CREATE TRIGGER set_contract_recipients_updated_at
    BEFORE UPDATE ON public.contract_recipients
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
