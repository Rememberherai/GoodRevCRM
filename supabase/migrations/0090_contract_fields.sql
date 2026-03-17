-- Migration 0090: Contract fields table
-- Stores field placements on document pages with position data and filled values

CREATE TABLE IF NOT EXISTS public.contract_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.contract_documents(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.contract_recipients(id) ON DELETE CASCADE,

    field_type TEXT NOT NULL CHECK (field_type IN (
        'signature','initials','date_signed','text_input',
        'checkbox','dropdown','name','email','company','title'
    )),
    label TEXT,
    placeholder TEXT,
    is_required BOOLEAN NOT NULL DEFAULT true,

    -- Position (percentage coordinates, resolution-independent)
    page_number INTEGER NOT NULL DEFAULT 1,
    x DECIMAL(10,4) NOT NULL,
    y DECIMAL(10,4) NOT NULL,
    width DECIMAL(10,4) NOT NULL,
    height DECIMAL(10,4) NOT NULL,

    options JSONB,
    validation_rule TEXT,
    auto_populate_from TEXT,

    -- Filled value
    value TEXT,
    filled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contract_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_fields_select" ON public.contract_fields
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_fields_insert" ON public.contract_fields
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_fields_update" ON public.contract_fields
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
        )
    );

CREATE POLICY "contract_fields_delete" ON public.contract_fields
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = contract_fields.project_id
              AND pm.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contract_fields_project_id ON public.contract_fields(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_fields_document_id ON public.contract_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_contract_fields_recipient_id ON public.contract_fields(recipient_id);
CREATE INDEX IF NOT EXISTS idx_contract_fields_document_page ON public.contract_fields(document_id, page_number);

-- Trigger
CREATE TRIGGER set_contract_fields_updated_at
    BEFORE UPDATE ON public.contract_fields
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
