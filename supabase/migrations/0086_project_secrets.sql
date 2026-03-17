-- Migration 0086: Project secrets table
-- Stores encrypted API keys and secrets per project (e.g., OpenRouter, FullEnrich, Google OAuth)
-- Values are encrypted with AES-256-GCM via lib/encryption.ts before storage

CREATE TABLE IF NOT EXISTS public.project_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_project_secret UNIQUE (project_id, key_name)
);

-- Enable RLS
ALTER TABLE public.project_secrets ENABLE ROW LEVEL SECURITY;

-- Only admins and owners can view secrets
CREATE POLICY "project_secrets_select" ON public.project_secrets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = project_secrets.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

-- Only admins and owners can insert secrets
CREATE POLICY "project_secrets_insert" ON public.project_secrets
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = project_secrets.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

-- Only admins and owners can update secrets
CREATE POLICY "project_secrets_update" ON public.project_secrets
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = project_secrets.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

-- Only admins and owners can delete secrets
CREATE POLICY "project_secrets_delete" ON public.project_secrets
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.project_memberships pm
            WHERE pm.project_id = project_secrets.project_id
              AND pm.user_id = auth.uid()
              AND pm.role IN ('admin', 'owner')
        )
    );

-- Apply updated_at trigger
CREATE TRIGGER set_project_secrets_updated_at
    BEFORE UPDATE ON public.project_secrets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Index for lookups by project (unique constraint already covers project_id + key_name)
CREATE INDEX IF NOT EXISTS idx_project_secrets_project_id ON public.project_secrets(project_id);

COMMENT ON TABLE public.project_secrets IS 'Encrypted API keys and secrets per project';
COMMENT ON COLUMN public.project_secrets.key_name IS 'Secret identifier, e.g. openrouter_api_key, fullenrich_api_key';
COMMENT ON COLUMN public.project_secrets.encrypted_value IS 'AES-256-GCM encrypted value in iv:authTag:ciphertext format';
