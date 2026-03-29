-- Migration 0178: WebAuthn/passkey support
-- Stores registered passkey credentials and temporary auth challenges

-- Credentials table: one row per registered passkey per user
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports TEXT[],
    device_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON public.webauthn_credentials(credential_id);

-- Challenges table: short-lived (5 min) challenges for registration and authentication
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT,
    challenge TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_challenge ON public.webauthn_challenges(challenge);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at ON public.webauthn_challenges(expires_at);

-- updated_at trigger for credentials
DROP TRIGGER IF EXISTS set_webauthn_credentials_updated_at ON public.webauthn_credentials;
CREATE TRIGGER set_webauthn_credentials_updated_at
    BEFORE UPDATE ON public.webauthn_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Users can read and delete their own credentials
DROP POLICY IF EXISTS "Users can view own credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can view own credentials"
    ON public.webauthn_credentials FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can delete own credentials"
    ON public.webauthn_credentials FOR DELETE
    USING (auth.uid() = user_id);

-- Challenges are managed by service role only (no user-facing RLS needed)
-- Service role bypasses RLS so no explicit policy needed for server operations
DROP POLICY IF EXISTS "No direct user access to challenges" ON public.webauthn_challenges;
CREATE POLICY "No direct user access to challenges"
    ON public.webauthn_challenges FOR ALL
    USING (false);
