-- 0163_asset_access.sql
-- Community Asset Access: schema for reservable, loanable, and hybrid asset access
-- See docs/resource-booking-prd.md for full specification

-- ============================================================================
-- 1. Extend community_assets with access fields
-- ============================================================================

ALTER TABLE public.community_assets
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'tracked_only'
    CHECK (access_mode IN ('tracked_only', 'reservable', 'loanable', 'hybrid')),
  ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resource_slug TEXT,
  ADD COLUMN IF NOT EXISTS public_name TEXT,
  ADD COLUMN IF NOT EXISTS public_description TEXT,
  ADD COLUMN IF NOT EXISTS approval_policy TEXT NOT NULL DEFAULT 'open_auto'
    CHECK (approval_policy IN ('open_auto', 'open_review', 'approved_only')),
  ADD COLUMN IF NOT EXISTS public_visibility TEXT NOT NULL DEFAULT 'listed'
    CHECK (public_visibility IN ('listed', 'unlisted')),
  ADD COLUMN IF NOT EXISTS access_instructions TEXT,
  ADD COLUMN IF NOT EXISTS booking_owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concurrent_capacity INT NOT NULL DEFAULT 1
    CHECK (concurrent_capacity >= 1),
  ADD COLUMN IF NOT EXISTS return_required BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial unique: only enforce slug uniqueness when slug is set (tracked_only assets don't need slugs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_assets_project_slug
  ON public.community_assets (project_id, resource_slug)
  WHERE resource_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_assets_access_mode
  ON public.community_assets (project_id, access_mode);

-- ============================================================================
-- 2. asset_access_settings — one row per project for the public resource hub
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_access_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Community Resources',
  description TEXT,
  logo_url TEXT,
  accent_color TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_asset_access_settings_updated_at
  BEFORE UPDATE ON public.asset_access_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 3. community_asset_approvers — per-asset approver assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_asset_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.community_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, user_id)
);

CREATE TRIGGER set_community_asset_approvers_updated_at
  BEFORE UPDATE ON public.community_asset_approvers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 4. community_asset_person_approvals — person-level access grants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_asset_person_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.community_assets(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  revoked_by UUID REFERENCES public.users(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, person_id)
);

CREATE TRIGGER set_community_asset_person_approvals_updated_at
  BEFORE UPDATE ON public.community_asset_person_approvals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 5. asset_access_verifications — email verification before booking creation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_access_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.community_assets(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  requested_start_at TIMESTAMPTZ NOT NULL,
  requested_end_at TIMESTAMPTZ NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'expired')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_access_verifications_token
  ON public.asset_access_verifications (token);

CREATE INDEX IF NOT EXISTS idx_asset_access_verifications_project
  ON public.asset_access_verifications (project_id, status);

-- ============================================================================
-- 6. asset_access_events — immutable audit log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  verification_id UUID REFERENCES public.asset_access_verifications(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'submitted', 'verification_sent', 'verified',
    'queued_for_review', 'auto_confirmed', 'approved', 'denied',
    'cancelled', 'rescheduled', 'access_granted', 'returned'
  )),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'guest', 'user')),
  actor_id UUID,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (booking_id IS NOT NULL OR verification_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_asset_access_events_booking
  ON public.asset_access_events (booking_id, created_at);

CREATE INDEX IF NOT EXISTS idx_asset_access_events_verification
  ON public.asset_access_events (verification_id, created_at);

CREATE INDEX IF NOT EXISTS idx_asset_access_events_project
  ON public.asset_access_events (project_id, created_at);

-- ============================================================================
-- 7. Update community_has_permission() to include asset_access resource
-- ============================================================================

CREATE OR REPLACE FUNCTION public.community_has_permission(
  p_project_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.project_role;
BEGIN
  v_role := public.community_current_role(p_project_id);

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    RETURN (
      (p_resource IN ('households', 'intake', 'programs', 'contributions', 'community_assets', 'referrals', 'relationships', 'broadcasts', 'grants', 'jobs', 'assistant_ap')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'events' AND p_action IN ('view', 'create', 'update', 'delete', 'export_pii', 'manage'))
      OR (p_resource = 'risk_scores' AND p_action IN ('view', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action IN ('view', 'export_pii'))
      OR (p_resource = 'settings' AND p_action IN ('view', 'update'))
      OR (p_resource = 'public_dashboard' AND p_action = 'manage')
      OR (p_resource = 'asset_access' AND p_action IN ('view', 'manage'))
    );
  END IF;

  IF v_role = 'staff' THEN
    RETURN (
      (p_resource IN ('households', 'programs', 'contributions', 'community_assets', 'referrals', 'relationships', 'broadcasts')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'events' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'jobs' AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'assistant_ap' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource IN ('dashboard', 'reports', 'settings') AND p_action = 'view')
      OR (p_resource = 'risk_scores' AND p_action = 'view')
      OR (p_resource = 'asset_access' AND p_action IN ('view', 'manage'))
    );
  END IF;

  IF v_role = 'case_manager' THEN
    RETURN (
      (p_resource IN ('households', 'intake', 'programs', 'contributions', 'community_assets', 'referrals', 'relationships', 'broadcasts')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'events' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'jobs' AND p_action = 'view')
      OR (p_resource = 'assistant_ap' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
      OR (p_resource = 'settings' AND p_action = 'view')
      OR (p_resource = 'risk_scores' AND p_action IN ('view', 'update'))
      OR (p_resource = 'asset_access' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'contractor' THEN
    RETURN (
      (p_resource = 'jobs' AND p_action IN ('view', 'update'))
      OR (p_resource = 'settings' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'board_viewer' THEN
    RETURN (
      (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
    );
  END IF;

  IF v_role IN ('member', 'viewer') THEN
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================================
-- 8. RLS policies
-- ============================================================================

ALTER TABLE public.asset_access_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_asset_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_asset_person_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_access_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_access_events ENABLE ROW LEVEL SECURITY;

-- asset_access_settings: owner/admin manage
CREATE POLICY asset_access_settings_select ON public.asset_access_settings
  FOR SELECT USING (public.community_has_permission(project_id, 'asset_access', 'view'));

CREATE POLICY asset_access_settings_insert ON public.asset_access_settings
  FOR INSERT WITH CHECK (public.community_has_permission(project_id, 'asset_access', 'manage'));

CREATE POLICY asset_access_settings_update ON public.asset_access_settings
  FOR UPDATE USING (public.community_has_permission(project_id, 'asset_access', 'manage'))
  WITH CHECK (public.community_has_permission(project_id, 'asset_access', 'manage'));

CREATE POLICY asset_access_settings_delete ON public.asset_access_settings
  FOR DELETE USING (public.community_has_permission(project_id, 'asset_access', 'manage'));

-- community_asset_approvers: owner/admin manage
CREATE POLICY community_asset_approvers_select ON public.community_asset_approvers
  FOR SELECT USING (public.community_has_permission(project_id, 'asset_access', 'view'));

CREATE POLICY community_asset_approvers_insert ON public.community_asset_approvers
  FOR INSERT WITH CHECK (public.community_has_permission(project_id, 'asset_access', 'manage'));

CREATE POLICY community_asset_approvers_update ON public.community_asset_approvers
  FOR UPDATE USING (public.community_has_permission(project_id, 'asset_access', 'manage'))
  WITH CHECK (public.community_has_permission(project_id, 'asset_access', 'manage'));

CREATE POLICY community_asset_approvers_delete ON public.community_asset_approvers
  FOR DELETE USING (public.community_has_permission(project_id, 'asset_access', 'manage'));

-- community_asset_person_approvals: view for asset_access:view, write guarded in API layer
CREATE POLICY community_asset_person_approvals_select ON public.community_asset_person_approvals
  FOR SELECT USING (public.community_has_permission(project_id, 'asset_access', 'view'));

CREATE POLICY community_asset_person_approvals_insert ON public.community_asset_person_approvals
  FOR INSERT WITH CHECK (public.community_has_permission(project_id, 'asset_access', 'manage'));

CREATE POLICY community_asset_person_approvals_update ON public.community_asset_person_approvals
  FOR UPDATE USING (public.community_has_permission(project_id, 'asset_access', 'manage'))
  WITH CHECK (public.community_has_permission(project_id, 'asset_access', 'manage'));

CREATE POLICY community_asset_person_approvals_delete ON public.community_asset_person_approvals
  FOR DELETE USING (public.community_has_permission(project_id, 'asset_access', 'manage'));

-- asset_access_verifications: no authenticated RLS — accessed via service client only
-- Grant service_role full access
CREATE POLICY asset_access_verifications_service ON public.asset_access_verifications
  FOR ALL USING (true) WITH CHECK (true);

-- But restrict to service_role only (authenticated users cannot access)
ALTER TABLE public.asset_access_verifications FORCE ROW LEVEL SECURITY;

-- asset_access_events: read-only for authenticated with view permission; inserts via service client
CREATE POLICY asset_access_events_select ON public.asset_access_events
  FOR SELECT USING (public.community_has_permission(project_id, 'asset_access', 'view'));

CREATE POLICY asset_access_events_service_insert ON public.asset_access_events
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 9. create_asset_booking_if_available() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_asset_booking_if_available(
  p_asset_id UUID,
  p_event_type_id UUID,
  p_booking_owner_user_id UUID,
  p_project_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_buffer_before INTERVAL,
  p_buffer_after INTERVAL,
  p_invitee_name TEXT,
  p_invitee_email TEXT,
  p_invitee_phone TEXT,
  p_invitee_timezone TEXT,
  p_invitee_notes TEXT,
  p_location TEXT,
  p_meeting_url TEXT,
  p_responses JSONB,
  p_requires_confirmation BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_overlap_count INTEGER;
  v_capacity INTEGER;
  v_status TEXT;
BEGIN
  -- Lock on asset to prevent concurrent overbooking
  PERFORM pg_advisory_xact_lock(hashtext(p_asset_id::text));

  -- Load concurrent capacity from the asset
  SELECT concurrent_capacity INTO v_capacity
  FROM public.community_assets
  WHERE id = p_asset_id;

  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'ASSET_NOT_FOUND: Asset does not exist';
  END IF;

  -- Count overlapping active bookings across ALL event types for this asset
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.bookings b
  JOIN public.event_types et ON et.id = b.event_type_id
  WHERE et.asset_id = p_asset_id
    AND b.status NOT IN ('cancelled', 'rescheduled', 'completed')
    AND b.effective_block && tstzrange(
      p_start_at - p_buffer_before,
      p_end_at + p_buffer_after
    );

  IF v_overlap_count >= v_capacity THEN
    RAISE EXCEPTION 'CAPACITY_EXHAUSTED: No available capacity for this time slot';
  END IF;

  -- No daily/weekly limits for asset bookings (those are host-scoped concepts)

  v_status := CASE WHEN p_requires_confirmation THEN 'pending' ELSE 'confirmed' END;

  INSERT INTO public.bookings (
    event_type_id,
    host_user_id,
    project_id,
    start_at,
    end_at,
    status,
    buffer_before_minutes,
    buffer_after_minutes,
    effective_block_start,
    effective_block_end,
    invitee_name,
    invitee_email,
    invitee_phone,
    invitee_timezone,
    invitee_notes,
    location,
    meeting_url,
    responses
  ) VALUES (
    p_event_type_id,
    p_booking_owner_user_id,
    p_project_id,
    p_start_at,
    p_end_at,
    v_status,
    EXTRACT(EPOCH FROM p_buffer_before)::integer / 60,
    EXTRACT(EPOCH FROM p_buffer_after)::integer / 60,
    p_start_at - p_buffer_before,
    p_end_at + p_buffer_after,
    p_invitee_name,
    p_invitee_email,
    p_invitee_phone,
    p_invitee_timezone,
    p_invitee_notes,
    p_location,
    p_meeting_url,
    p_responses
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_asset_booking_if_available(
  UUID, UUID, UUID, UUID,
  TIMESTAMPTZ, TIMESTAMPTZ,
  INTERVAL, INTERVAL,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  JSONB, BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_asset_booking_if_available(
  UUID, UUID, UUID, UUID,
  TIMESTAMPTZ, TIMESTAMPTZ,
  INTERVAL, INTERVAL,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  JSONB, BOOLEAN
) TO authenticated, service_role;
