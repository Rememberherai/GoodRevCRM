-- Migration: 0157_member_permission_overrides.sql
-- Description: Per-user feature-level permission overrides on top of role-based access

CREATE TABLE IF NOT EXISTS public.project_membership_overrides (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  resource   TEXT        NOT NULL,
  granted    BOOLEAN     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id, resource)
);

CREATE INDEX IF NOT EXISTS pmo_project_user_idx
  ON public.project_membership_overrides(project_id, user_id);

ALTER TABLE public.project_membership_overrides ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.project_membership_overrides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Owners and admins can read and write all overrides for their project
CREATE POLICY "overrides_admin_access" ON public.project_membership_overrides
  USING (
    EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = project_membership_overrides.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = project_membership_overrides.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );

-- Users can read their own overrides (required: permission checks run under user JWT)
CREATE POLICY "overrides_self_read" ON public.project_membership_overrides
  FOR SELECT
  USING (user_id = auth.uid());
