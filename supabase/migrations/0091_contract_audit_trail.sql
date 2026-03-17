-- Migration 0091: Contract audit trail table
-- Immutable legal audit record for all contract events
-- No UPDATE/DELETE policies — all inserts via service role only

CREATE TABLE IF NOT EXISTS public.contract_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.contract_documents(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.contract_recipients(id) ON DELETE SET NULL,

    action TEXT NOT NULL CHECK (action IN (
        'created','sent','send_failed','viewed','field_filled','signed','declined',
        'voided','reminder_sent','delegated','downloaded','completed',
        'expired','consent_given','link_opened','signature_adopted'
    )),
    actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','signer','system')),
    actor_id TEXT,
    actor_name TEXT,

    ip_address TEXT,
    user_agent TEXT,
    details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contract_audit_trail ENABLE ROW LEVEL SECURITY;

-- Only SELECT for project members — inserts are done via service role
CREATE POLICY "contract_audit_trail_select" ON public.contract_audit_trail
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_audit_trail.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_audit_trail_project_id ON public.contract_audit_trail(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_trail_document_id ON public.contract_audit_trail(document_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_trail_recipient_id ON public.contract_audit_trail(recipient_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_trail_action ON public.contract_audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_contract_audit_trail_created_at ON public.contract_audit_trail(created_at);
