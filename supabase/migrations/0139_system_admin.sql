-- Migration 0139: System Admin Panel
-- Adds system admin flag, audit log, settings, session tracking, and bug report triage columns.
-- NOTE: Idempotent — objects may already exist from a prior push.

------------------------------------------------------------------------
-- 4.1  System Admin Flag
------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

------------------------------------------------------------------------
-- 4.2  System Admin Audit Log
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_admin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_admin_log_admin   ON public.system_admin_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_system_admin_log_action  ON public.system_admin_log(action);
CREATE INDEX IF NOT EXISTS idx_system_admin_log_target  ON public.system_admin_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_system_admin_log_created ON public.system_admin_log(created_at DESC);

------------------------------------------------------------------------
-- 4.3  System Settings (key-value store)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on change
DROP TRIGGER IF EXISTS set_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default settings
INSERT INTO public.system_settings (key, value)
VALUES
  ('require_project_api_keys', '{"openrouter": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

------------------------------------------------------------------------
-- 4.4  System Admin Sessions
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.project_memberships(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ
);

-- Partial unique index: only one ACTIVE session per admin per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_admin_session
  ON public.system_admin_sessions (admin_user_id, project_id)
  WHERE exited_at IS NULL;

------------------------------------------------------------------------
-- 4.5  RLS Policies
------------------------------------------------------------------------

-- system_admin_log
ALTER TABLE public.system_admin_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can view admin log" ON public.system_admin_log;
CREATE POLICY "System admins can view admin log"
  ON public.system_admin_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

DROP POLICY IF EXISTS "System admins can insert admin log" ON public.system_admin_log;
CREATE POLICY "System admins can insert admin log"
  ON public.system_admin_log FOR INSERT
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can manage system settings" ON public.system_settings;
CREATE POLICY "System admins can manage system settings"
  ON public.system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- system_admin_sessions
ALTER TABLE public.system_admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can manage admin sessions" ON public.system_admin_sessions;
CREATE POLICY "System admins can manage admin sessions"
  ON public.system_admin_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Allow system admins to SELECT all projects
DROP POLICY IF EXISTS "System admins can view all projects" ON public.projects;
CREATE POLICY "System admins can view all projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Allow system admins to read all users
DROP POLICY IF EXISTS "System admins can view all users" ON public.users;
CREATE POLICY "System admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

------------------------------------------------------------------------
-- 4.6  SQL Helper Function
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_system_admin = TRUE
  );
$$;

------------------------------------------------------------------------
-- 4.7  Bug Reports — admin RLS + triage columns
------------------------------------------------------------------------

-- Admin policy for bug_reports
DROP POLICY IF EXISTS "System admins can manage all bug reports" ON public.bug_reports;
CREATE POLICY "System admins can manage all bug reports"
  ON public.bug_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_system_admin = TRUE
    )
  );

-- Triage columns
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bug_reports_priority    ON public.bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_assigned_to ON public.bug_reports(assigned_to);

------------------------------------------------------------------------
-- Comments
------------------------------------------------------------------------
COMMENT ON COLUMN public.users.is_system_admin IS 'Platform-level admin flag. Granted via CLI script only.';
COMMENT ON TABLE public.system_admin_log IS 'Audit log for all system admin actions';
COMMENT ON TABLE public.system_settings IS 'Global platform settings (key-value store)';
COMMENT ON TABLE public.system_admin_sessions IS 'Tracks admin enter/exit project sessions';
