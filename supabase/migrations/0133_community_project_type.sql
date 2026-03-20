-- Migration 0133: Community project type foundation
-- Adds community schema, RLS, and framework templates.
-- Role enum extensions are in 0132_community_role_enum.sql (must be a
-- separate transaction so Postgres commits the new enum values first).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS accounting_target TEXT,
  ADD COLUMN IF NOT EXISTS accounting_company_id UUID,
  ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS impact_framework_id UUID;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_project_type_check,
  ADD CONSTRAINT projects_project_type_check CHECK (project_type IN ('standard', 'community'));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_accounting_target_check,
  ADD CONSTRAINT projects_accounting_target_check CHECK (
    accounting_target IS NULL
    OR accounting_target IN ('goodrev', 'quickbooks', 'none')
  );

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_contractor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_volunteer BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_referral_partner BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.impact_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('ccf', 'vital_conditions', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.impact_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES public.impact_frameworks(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT impact_dimensions_framework_key_unique UNIQUE (framework_id, key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_accounting_company_id_fkey'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_accounting_company_id_fkey
      FOREIGN KEY (accounting_company_id)
      REFERENCES public.accounting_companies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_impact_framework_id_fkey'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_impact_framework_id_fkey
      FOREIGN KEY (impact_framework_id)
      REFERENCES public.impact_frameworks(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geocoded_status TEXT NOT NULL DEFAULT 'pending' CHECK (geocoded_status IN ('pending', 'success', 'failed', 'manual')),
  household_size INTEGER CHECK (household_size IS NULL OR household_size >= 0),
  primary_contact_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  notes TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::JSONB,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('head_of_household', 'spouse_partner', 'child', 'dependent', 'extended_family', 'other')),
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT household_members_unique_span UNIQUE (household_id, person_id, start_date)
);

CREATE TABLE IF NOT EXISTS public.household_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  needs JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_dimensions UUID[] NOT NULL DEFAULT '{}'::UUID[],
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'suspended')),
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  schedule JSONB,
  location_name TEXT,
  location_latitude DOUBLE PRECISION,
  location_longitude DOUBLE PRECISION,
  start_date DATE,
  end_date DATE,
  requires_waiver BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn', 'waitlisted')),
  waiver_status TEXT NOT NULL DEFAULT 'not_required' CHECK (waiver_status IN ('not_required', 'pending', 'signed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT program_enrollments_target_required CHECK (person_id IS NOT NULL OR household_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.program_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT program_attendance_unique UNIQUE (program_id, person_id, date)
);

CREATE TABLE IF NOT EXISTS public.community_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('facility', 'land', 'equipment', 'vehicle', 'technology', 'other')),
  dimension_id UUID REFERENCES public.impact_dimensions(id) ON DELETE SET NULL,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geocoded_status TEXT NOT NULL DEFAULT 'pending' CHECK (geocoded_status IN ('pending', 'success', 'failed', 'manual')),
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  value_estimate NUMERIC(14,2),
  steward_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  steward_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contractor_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'active', 'expired', 'cancelled')),
  start_date DATE,
  end_date DATE,
  compensation_terms TEXT,
  service_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  certifications TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  service_area_radius_miles NUMERIC(8,2),
  home_base_latitude DOUBLE PRECISION,
  home_base_longitude DOUBLE PRECISION,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  scope_id UUID REFERENCES public.contractor_scopes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('draft', 'assigned', 'accepted', 'in_progress', 'paused', 'completed', 'declined', 'pulled', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  desired_start TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  service_address TEXT,
  service_category TEXT,
  required_certifications TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  service_latitude DOUBLE PRECISION,
  service_longitude DOUBLE PRECISION,
  is_out_of_scope BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  pulled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipt_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  vendor TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  receipt_date DATE NOT NULL,
  description TEXT,
  account_code TEXT,
  class_name TEXT,
  ocr_raw JSONB NOT NULL DEFAULT '{}'::JSONB,
  accounting_target TEXT NOT NULL CHECK (accounting_target IN ('goodrev', 'quickbooks')),
  external_bill_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'executed', 'failed')),
  image_url TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  funder_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  contact_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'researching' CHECK (status IN ('researching', 'preparing', 'submitted', 'under_review', 'awarded', 'declined')),
  amount_requested NUMERIC(14,2),
  amount_awarded NUMERIC(14,2),
  loi_due_at TIMESTAMPTZ,
  application_due_at TIMESTAMPTZ,
  report_due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('monetary', 'in_kind', 'volunteer_hours', 'grant', 'service')),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('pledged', 'received', 'completed', 'cancelled')),
  dimension_id UUID REFERENCES public.impact_dimensions(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  grant_id UUID REFERENCES public.grants(id) ON DELETE SET NULL,
  donor_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  donor_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  donor_household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  recipient_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  recipient_household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  value NUMERIC(14,2),
  hours NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  partner_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'in_progress', 'completed', 'closed')),
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referrals_target_required CHECK (person_id IS NOT NULL OR household_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_a_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('neighbor', 'family', 'mentor_mentee', 'friend', 'caregiver', 'colleague', 'service_provider_client', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT relationships_distinct_people CHECK (person_a_id <> person_b_id),
  CONSTRAINT relationships_unique_pair UNIQUE (project_id, person_a_id, person_b_id, type)
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  filter_criteria JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_dashboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'published', 'archived')),
  theme JSONB NOT NULL DEFAULT '{}'::JSONB,
  widget_order UUID[] NOT NULL DEFAULT '{}'::UUID[],
  widgets JSONB NOT NULL DEFAULT '[]'::JSONB,
  hero_image_url TEXT,
  min_count_threshold INTEGER NOT NULL DEFAULT 5 CHECK (min_count_threshold >= 3),
  excluded_categories TEXT[] NOT NULL DEFAULT ARRAY['minors', 'intake', 'risk_scores', 'PII']::TEXT[],
  access_type TEXT NOT NULL DEFAULT 'public' CHECK (access_type IN ('public', 'password', 'signed_link')),
  password_hash TEXT,
  data_freshness TEXT NOT NULL DEFAULT 'live' CHECK (data_freshness IN ('live', 'snapshot')),
  snapshot_data JSONB,
  date_range_type TEXT NOT NULL DEFAULT 'rolling' CHECK (date_range_type IN ('rolling', 'fixed')),
  date_range_start DATE,
  date_range_end DATE,
  geo_granularity TEXT NOT NULL DEFAULT 'zip' CHECK (geo_granularity IN ('zip', 'neighborhood')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT public_dashboard_configs_project_slug_unique UNIQUE (project_id, slug),
  CONSTRAINT public_dashboard_configs_password_required CHECK (
    access_type <> 'password' OR password_hash IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.public_dashboard_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.public_dashboard_configs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.community_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_project_type ON public.projects(project_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_project_user_id_unique
  ON public.people(project_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_contractor ON public.people(project_id, is_contractor)
  WHERE is_contractor IS TRUE;
CREATE INDEX IF NOT EXISTS idx_organizations_referral_partner
  ON public.organizations(project_id, is_referral_partner)
  WHERE is_referral_partner IS TRUE;
CREATE INDEX IF NOT EXISTS idx_impact_frameworks_project_id ON public.impact_frameworks(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_impact_frameworks_global_type_unique
  ON public.impact_frameworks(type)
  WHERE project_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_impact_dimensions_framework_id ON public.impact_dimensions(framework_id);
CREATE INDEX IF NOT EXISTS idx_households_project_id ON public.households(project_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id_end_date ON public.household_members(household_id, end_date);
CREATE INDEX IF NOT EXISTS idx_household_members_person_id_dates ON public.household_members(person_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_programs_project_id_status ON public.programs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_program_attendance_program_date ON public.program_attendance(program_id, date);
CREATE INDEX IF NOT EXISTS idx_contributions_project_dimension ON public.contributions(project_id, dimension_id);
CREATE INDEX IF NOT EXISTS idx_contributions_donor_person_date ON public.contributions(donor_person_id, date);
CREATE INDEX IF NOT EXISTS idx_community_assets_project_id ON public.community_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_contractor_status ON public.jobs(project_id, contractor_id, status);
CREATE INDEX IF NOT EXISTS idx_grants_project_status ON public.grants(project_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_project_status ON public.referrals(project_id, status);
CREATE INDEX IF NOT EXISTS idx_public_dashboard_share_links_token ON public.public_dashboard_share_links(token);

DROP TRIGGER IF EXISTS set_impact_frameworks_updated_at ON public.impact_frameworks;
CREATE TRIGGER set_impact_frameworks_updated_at
  BEFORE UPDATE ON public.impact_frameworks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_impact_dimensions_updated_at ON public.impact_dimensions;
CREATE TRIGGER set_impact_dimensions_updated_at
  BEFORE UPDATE ON public.impact_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_households_updated_at ON public.households;
CREATE TRIGGER set_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_household_members_updated_at ON public.household_members;
CREATE TRIGGER set_household_members_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_household_intake_updated_at ON public.household_intake;
CREATE TRIGGER set_household_intake_updated_at
  BEFORE UPDATE ON public.household_intake
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_programs_updated_at ON public.programs;
CREATE TRIGGER set_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_program_enrollments_updated_at ON public.program_enrollments;
CREATE TRIGGER set_program_enrollments_updated_at
  BEFORE UPDATE ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_program_attendance_updated_at ON public.program_attendance;
CREATE TRIGGER set_program_attendance_updated_at
  BEFORE UPDATE ON public.program_attendance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_community_assets_updated_at ON public.community_assets;
CREATE TRIGGER set_community_assets_updated_at
  BEFORE UPDATE ON public.community_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_contractor_scopes_updated_at ON public.contractor_scopes;
CREATE TRIGGER set_contractor_scopes_updated_at
  BEFORE UPDATE ON public.contractor_scopes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;
CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_job_time_entries_updated_at ON public.job_time_entries;
CREATE TRIGGER set_job_time_entries_updated_at
  BEFORE UPDATE ON public.job_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_receipt_confirmations_updated_at ON public.receipt_confirmations;
CREATE TRIGGER set_receipt_confirmations_updated_at
  BEFORE UPDATE ON public.receipt_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_grants_updated_at ON public.grants;
CREATE TRIGGER set_grants_updated_at
  BEFORE UPDATE ON public.grants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_contributions_updated_at ON public.contributions;
CREATE TRIGGER set_contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_referrals_updated_at ON public.referrals;
CREATE TRIGGER set_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_relationships_updated_at ON public.relationships;
CREATE TRIGGER set_relationships_updated_at
  BEFORE UPDATE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_broadcasts_updated_at ON public.broadcasts;
CREATE TRIGGER set_broadcasts_updated_at
  BEFORE UPDATE ON public.broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_public_dashboard_configs_updated_at ON public.public_dashboard_configs;
CREATE TRIGGER set_public_dashboard_configs_updated_at
  BEFORE UPDATE ON public.public_dashboard_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_public_dashboard_share_links_updated_at ON public.public_dashboard_share_links;
CREATE TRIGGER set_public_dashboard_share_links_updated_at
  BEFORE UPDATE ON public.public_dashboard_share_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.community_current_role(p_project_id UUID)
RETURNS public.project_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.project_role;
BEGIN
  SELECT role
  INTO v_role
  FROM public.project_memberships
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
  LIMIT 1;

  RETURN v_role;
END;
$$;

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
      (p_resource IN ('households', 'intake', 'programs', 'contributions', 'community_assets', 'referrals', 'grants', 'jobs', 'assistant_ap')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'risk_scores' AND p_action IN ('view', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action IN ('view', 'export_pii'))
      OR (p_resource = 'settings' AND p_action IN ('view', 'update'))
      OR (p_resource = 'public_dashboard' AND p_action = 'manage')
    );
  END IF;

  IF v_role = 'staff' THEN
    RETURN (
      (p_resource IN ('households', 'programs', 'contributions', 'community_assets', 'referrals')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'jobs' AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'assistant_ap' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource IN ('dashboard', 'reports', 'settings') AND p_action = 'view')
      OR (p_resource = 'risk_scores' AND p_action = 'view')
    );
  END IF;

  IF v_role = 'case_manager' THEN
    RETURN (
      (p_resource IN ('households', 'intake', 'programs', 'contributions', 'community_assets', 'referrals')
        AND p_action IN ('view', 'create', 'update', 'delete'))
      OR (p_resource = 'grants' AND p_action = 'view')
      OR (p_resource = 'jobs' AND p_action = 'view')
      OR (p_resource = 'assistant_ap' AND p_action IN ('view', 'create', 'update'))
      OR (p_resource = 'dashboard' AND p_action = 'view')
      OR (p_resource = 'reports' AND p_action = 'view')
      OR (p_resource = 'settings' AND p_action = 'view')
      OR (p_resource = 'risk_scores' AND p_action IN ('view', 'update'))
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

CREATE OR REPLACE FUNCTION public.community_can_access_shared_directory(
  p_project_id UUID,
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
  v_project_type TEXT;
BEGIN
  SELECT project_type
  INTO v_project_type
  FROM public.projects
  WHERE id = p_project_id;

  IF v_project_type IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_project_type = 'standard' THEN
    IF p_action = 'view' THEN
      RETURN public.is_project_member(p_project_id);
    END IF;

    RETURN public.has_project_role(p_project_id, 'member');
  END IF;

  v_role := public.community_current_role(p_project_id);

  IF v_role IN ('owner', 'admin', 'staff', 'case_manager') THEN
    RETURN p_action IN ('view', 'create', 'update', 'delete');
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_contractor_person_id(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.people
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
    AND is_contractor IS TRUE
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.community_contractor_can_view_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_role public.project_role;
  v_person_id UUID;
BEGIN
  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF v_job.id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_role := public.community_current_role(v_job.project_id);

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role <> 'contractor' THEN
    RETURN public.community_has_permission(v_job.project_id, 'jobs', 'view');
  END IF;

  v_person_id := public.community_contractor_person_id(v_job.project_id);

  IF v_person_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_job.contractor_id = v_person_id THEN
    RETURN TRUE;
  END IF;

  IF v_job.contractor_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.contractor_scopes cs
    WHERE cs.project_id = v_job.project_id
      AND cs.contractor_id = v_person_id
      AND cs.status = 'active'
      AND (
        v_job.service_category IS NULL
        OR array_length(cs.service_categories, 1) IS NULL
        OR v_job.service_category = ANY (cs.service_categories)
      )
      AND (
        array_length(v_job.required_certifications, 1) IS NULL
        OR array_length(cs.certifications, 1) IS NULL
        OR v_job.required_certifications <@ cs.certifications
      )
      AND (
        cs.service_area_radius_miles IS NULL
        OR cs.home_base_latitude IS NULL
        OR cs.home_base_longitude IS NULL
        OR v_job.service_latitude IS NULL
        OR v_job.service_longitude IS NULL
        OR sqrt(
          power(cs.home_base_latitude - v_job.service_latitude, 2)
          + power(cs.home_base_longitude - v_job.service_longitude, 2)
        ) <= (cs.service_area_radius_miles / 69.0)
      )
  );
END;
$$;

ALTER TABLE public.impact_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_dashboard_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impact_frameworks_select ON public.impact_frameworks;
CREATE POLICY impact_frameworks_select ON public.impact_frameworks
  FOR SELECT
  USING (
    project_id IS NULL
    OR public.community_has_permission(project_id, 'settings', 'view')
  );

DROP POLICY IF EXISTS impact_frameworks_write ON public.impact_frameworks;
CREATE POLICY impact_frameworks_write ON public.impact_frameworks
  FOR ALL
  USING (
    project_id IS NOT NULL
    AND public.community_has_permission(project_id, 'settings', 'update')
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND public.community_has_permission(project_id, 'settings', 'update')
  );

DROP POLICY IF EXISTS impact_dimensions_select ON public.impact_dimensions;
CREATE POLICY impact_dimensions_select ON public.impact_dimensions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.impact_frameworks f
      WHERE f.id = framework_id
        AND (
          f.project_id IS NULL
          OR public.community_has_permission(f.project_id, 'settings', 'view')
        )
    )
  );

DROP POLICY IF EXISTS impact_dimensions_write ON public.impact_dimensions;
CREATE POLICY impact_dimensions_write ON public.impact_dimensions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.impact_frameworks f
      WHERE f.id = framework_id
        AND f.project_id IS NOT NULL
        AND public.community_has_permission(f.project_id, 'settings', 'update')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.impact_frameworks f
      WHERE f.id = framework_id
        AND f.project_id IS NOT NULL
        AND public.community_has_permission(f.project_id, 'settings', 'update')
    )
  );

DROP POLICY IF EXISTS households_access ON public.households;
CREATE POLICY households_access ON public.households
  FOR ALL
  USING (
    deleted_at IS NULL
    AND public.community_has_permission(project_id, 'households', 'view')
  )
  WITH CHECK (public.community_has_permission(project_id, 'households', 'create'));

DROP POLICY IF EXISTS household_members_select ON public.household_members;
CREATE POLICY household_members_select ON public.household_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = household_id
        AND public.community_has_permission(h.project_id, 'households', 'view')
    )
  );

DROP POLICY IF EXISTS household_members_write ON public.household_members;
CREATE POLICY household_members_write ON public.household_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = household_id
        AND public.community_has_permission(h.project_id, 'households', 'update')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = household_id
        AND public.community_has_permission(h.project_id, 'households', 'update')
    )
  );

DROP POLICY IF EXISTS household_intake_access ON public.household_intake;
CREATE POLICY household_intake_access ON public.household_intake
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = household_id
        AND public.community_has_permission(h.project_id, 'intake', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = household_id
        AND public.community_has_permission(h.project_id, 'intake', 'create')
    )
  );

DROP POLICY IF EXISTS programs_access ON public.programs;
CREATE POLICY programs_access ON public.programs
  FOR ALL
  USING (public.community_has_permission(project_id, 'programs', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'programs', 'create'));

DROP POLICY IF EXISTS program_enrollments_access ON public.program_enrollments;
CREATE POLICY program_enrollments_access ON public.program_enrollments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.programs p
      WHERE p.id = program_id
        AND public.community_has_permission(p.project_id, 'programs', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.programs p
      WHERE p.id = program_id
        AND public.community_has_permission(p.project_id, 'programs', 'create')
    )
  );

DROP POLICY IF EXISTS program_attendance_access ON public.program_attendance;
CREATE POLICY program_attendance_access ON public.program_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.programs p
      WHERE p.id = program_id
        AND public.community_has_permission(p.project_id, 'programs', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.programs p
      WHERE p.id = program_id
        AND public.community_has_permission(p.project_id, 'programs', 'update')
    )
  );

DROP POLICY IF EXISTS community_assets_access ON public.community_assets;
CREATE POLICY community_assets_access ON public.community_assets
  FOR ALL
  USING (public.community_has_permission(project_id, 'community_assets', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'community_assets', 'create'));

DROP POLICY IF EXISTS contractor_scopes_select ON public.contractor_scopes;
CREATE POLICY contractor_scopes_select ON public.contractor_scopes
  FOR SELECT
  USING (
    public.community_current_role(project_id) IN ('owner', 'admin', 'staff')
    OR EXISTS (
      SELECT 1
      FROM public.people p
      WHERE p.id = contractor_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contractor_scopes_insert ON public.contractor_scopes;
CREATE POLICY contractor_scopes_insert ON public.contractor_scopes
  FOR INSERT
  WITH CHECK (public.community_current_role(project_id) IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS contractor_scopes_update ON public.contractor_scopes;
CREATE POLICY contractor_scopes_update ON public.contractor_scopes
  FOR UPDATE
  USING (public.community_current_role(project_id) IN ('owner', 'admin', 'staff'))
  WITH CHECK (public.community_current_role(project_id) IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS contractor_scopes_delete ON public.contractor_scopes;
CREATE POLICY contractor_scopes_delete ON public.contractor_scopes
  FOR DELETE
  USING (public.community_current_role(project_id) IN ('owner', 'admin', 'staff'));

DROP POLICY IF EXISTS jobs_select ON public.jobs;
CREATE POLICY jobs_select ON public.jobs
  FOR SELECT
  USING (public.community_contractor_can_view_job(id));

DROP POLICY IF EXISTS jobs_write ON public.jobs;
DROP POLICY IF EXISTS jobs_insert ON public.jobs;
CREATE POLICY jobs_insert ON public.jobs
  FOR INSERT
  WITH CHECK (public.community_has_permission(project_id, 'jobs', 'create'));

DROP POLICY IF EXISTS jobs_update ON public.jobs;
CREATE POLICY jobs_update ON public.jobs
  FOR UPDATE
  USING (
    public.community_has_permission(project_id, 'jobs', 'update')
    OR (
      public.community_current_role(project_id) = 'contractor'
      AND contractor_id = public.community_contractor_person_id(project_id)
    )
  )
  WITH CHECK (
    public.community_has_permission(project_id, 'jobs', 'update')
    OR (
      public.community_current_role(project_id) = 'contractor'
      AND contractor_id = public.community_contractor_person_id(project_id)
    )
  );

DROP POLICY IF EXISTS jobs_delete ON public.jobs;
CREATE POLICY jobs_delete ON public.jobs
  FOR DELETE
  USING (public.community_has_permission(project_id, 'jobs', 'delete'));

DROP POLICY IF EXISTS job_time_entries_access ON public.job_time_entries;
CREATE POLICY job_time_entries_access ON public.job_time_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND public.community_contractor_can_view_job(j.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_id
        AND (
          public.community_has_permission(j.project_id, 'jobs', 'update')
          OR (
            public.community_current_role(j.project_id) = 'contractor'
            AND j.contractor_id = public.community_contractor_person_id(j.project_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS receipt_confirmations_select ON public.receipt_confirmations;
CREATE POLICY receipt_confirmations_select ON public.receipt_confirmations
  FOR SELECT
  USING (public.community_has_permission(project_id, 'assistant_ap', 'view'));

DROP POLICY IF EXISTS receipt_confirmations_insert ON public.receipt_confirmations;
CREATE POLICY receipt_confirmations_insert ON public.receipt_confirmations
  FOR INSERT
  WITH CHECK (public.community_has_permission(project_id, 'assistant_ap', 'create'));

DROP POLICY IF EXISTS receipt_confirmations_update ON public.receipt_confirmations;
CREATE POLICY receipt_confirmations_update ON public.receipt_confirmations
  FOR UPDATE
  USING (public.community_has_permission(project_id, 'assistant_ap', 'update'))
  WITH CHECK (public.community_has_permission(project_id, 'assistant_ap', 'update'));

DROP POLICY IF EXISTS receipt_confirmations_delete ON public.receipt_confirmations;
CREATE POLICY receipt_confirmations_delete ON public.receipt_confirmations
  FOR DELETE
  USING (public.community_current_role(project_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS grants_select ON public.grants;
CREATE POLICY grants_select ON public.grants
  FOR SELECT
  USING (public.community_has_permission(project_id, 'grants', 'view'));

DROP POLICY IF EXISTS grants_insert ON public.grants;
CREATE POLICY grants_insert ON public.grants
  FOR INSERT
  WITH CHECK (public.community_has_permission(project_id, 'grants', 'create'));

DROP POLICY IF EXISTS grants_update ON public.grants;
CREATE POLICY grants_update ON public.grants
  FOR UPDATE
  USING (public.community_has_permission(project_id, 'grants', 'update'))
  WITH CHECK (public.community_has_permission(project_id, 'grants', 'update'));

DROP POLICY IF EXISTS grants_delete ON public.grants;
CREATE POLICY grants_delete ON public.grants
  FOR DELETE
  USING (public.community_has_permission(project_id, 'grants', 'delete'));

DROP POLICY IF EXISTS contributions_access ON public.contributions;
CREATE POLICY contributions_access ON public.contributions
  FOR ALL
  USING (public.community_has_permission(project_id, 'contributions', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'contributions', 'create'));

DROP POLICY IF EXISTS referrals_access ON public.referrals;
CREATE POLICY referrals_access ON public.referrals
  FOR ALL
  USING (public.community_has_permission(project_id, 'referrals', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'referrals', 'create'));

DROP POLICY IF EXISTS relationships_access ON public.relationships;
CREATE POLICY relationships_access ON public.relationships
  FOR ALL
  USING (public.community_current_role(project_id) IN ('owner', 'admin', 'staff', 'case_manager'))
  WITH CHECK (public.community_current_role(project_id) IN ('owner', 'admin', 'staff', 'case_manager'));

DROP POLICY IF EXISTS broadcasts_access ON public.broadcasts;
CREATE POLICY broadcasts_access ON public.broadcasts
  FOR ALL
  USING (public.community_current_role(project_id) IN ('owner', 'admin', 'staff', 'case_manager'))
  WITH CHECK (public.community_current_role(project_id) IN ('owner', 'admin', 'staff', 'case_manager'));

DROP POLICY IF EXISTS public_dashboard_configs_access ON public.public_dashboard_configs;
CREATE POLICY public_dashboard_configs_access ON public.public_dashboard_configs
  FOR ALL
  USING (public.community_has_permission(project_id, 'public_dashboard', 'manage'))
  WITH CHECK (public.community_has_permission(project_id, 'public_dashboard', 'manage'));

DROP POLICY IF EXISTS public_dashboard_share_links_access ON public.public_dashboard_share_links;
CREATE POLICY public_dashboard_share_links_access ON public.public_dashboard_share_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_dashboard_configs c
      WHERE c.id = config_id
        AND public.community_has_permission(c.project_id, 'public_dashboard', 'manage')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.public_dashboard_configs c
      WHERE c.id = config_id
        AND public.community_has_permission(c.project_id, 'public_dashboard', 'manage')
    )
  );

INSERT INTO public.impact_frameworks (id, project_id, name, description, type, is_active)
SELECT
  '11111111-1111-1111-1111-111111111111'::UUID,
  NULL,
  'Community Capitals Framework',
  'Seven forms of community wealth used to track holistic community impact.',
  'ccf',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.impact_frameworks
  WHERE project_id IS NULL
    AND type = 'ccf'
);

INSERT INTO public.impact_frameworks (id, project_id, name, description, type, is_active)
SELECT
  '22222222-2222-2222-2222-222222222222'::UUID,
  NULL,
  '7 Vital Conditions for Health and Well-Being',
  'A framework for measuring the conditions communities need to thrive.',
  'vital_conditions',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.impact_frameworks
  WHERE project_id IS NULL
    AND type = 'vital_conditions'
);

INSERT INTO public.impact_dimensions (framework_id, key, label, description, color, icon, sort_order, is_active)
SELECT *
FROM (
  VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, 'natural', 'Natural', 'Land, water, air, biodiversity, environment, and food systems.', '#22c55e', 'Leaf', 0, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'cultural', 'Cultural', 'Heritage, arts, identity, practices, and traditions.', '#a855f7', 'Palette', 1, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'human', 'Human', 'Education, skills, health, and workforce development.', '#3b82f6', 'GraduationCap', 2, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'social', 'Social', 'Relationships, trust, belonging, bonding, and bridging.', '#f97316', 'Handshake', 3, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'political', 'Political', 'Civic engagement, advocacy, representation, and self-organization.', '#ef4444', 'Vote', 4, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'financial', 'Financial', 'Donations, grants, fundraising, and economic resources.', '#10b981', 'DollarSign', 5, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'built', 'Built', 'Facilities, infrastructure, technology, and housing.', '#64748b', 'Hammer', 6, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'humility_learning', 'Humility & Willingness to Learn', 'A culture of listening, learning, and continuous improvement.', '#0f766e', 'Brain', 0, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'belonging_civic_muscle', 'Belonging & Civic Muscle', 'Connected communities with strong participation and voice.', '#f59e0b', 'Users', 1, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'thriving_natural_world', 'Thriving Natural World', 'Healthy environments and stewardship of natural resources.', '#16a34a', 'TreePine', 2, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'basic_needs', 'Basic Needs', 'Food, housing, safety, and health needs are reliably met.', '#dc2626', 'HeartHandshake', 3, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'lifelong_learning', 'Lifelong Learning', 'Access to learning and growth across the lifespan.', '#2563eb', 'BookOpen', 4, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'meaningful_work_wealth', 'Meaningful Work & Wealth', 'Stable economic opportunity and pathways to prosperity.', '#7c3aed', 'BriefcaseBusiness', 5, TRUE),
    ('22222222-2222-2222-2222-222222222222'::UUID, 'reliable_transportation', 'Reliable Transportation', 'Dependable mobility that supports connection and opportunity.', '#0891b2', 'Bus', 6, TRUE)
) AS seeded(framework_id, key, label, description, color, icon, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.impact_dimensions d
  WHERE d.framework_id = seeded.framework_id
    AND d.key = seeded.key
);

DROP POLICY IF EXISTS "Members can view project organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Members can delete organizations" ON public.organizations;
DROP POLICY IF EXISTS "Viewers can view organizations" ON public.organizations;

CREATE POLICY "Project users can view organizations"
  ON public.organizations
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.community_can_access_shared_directory(project_id, 'view')
  );

CREATE POLICY "Project users can create organizations"
  ON public.organizations
  FOR INSERT
  WITH CHECK (public.community_can_access_shared_directory(project_id, 'create'));

CREATE POLICY "Project users can update organizations"
  ON public.organizations
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.community_can_access_shared_directory(project_id, 'update')
  )
  WITH CHECK (public.community_can_access_shared_directory(project_id, 'update'));

CREATE POLICY "Project users can delete organizations"
  ON public.organizations
  FOR DELETE
  USING (public.community_can_access_shared_directory(project_id, 'delete'));

DROP POLICY IF EXISTS "Members can view project people" ON public.people;
DROP POLICY IF EXISTS "Members can create people" ON public.people;
DROP POLICY IF EXISTS "Members can update people" ON public.people;
DROP POLICY IF EXISTS "Members can delete people" ON public.people;
DROP POLICY IF EXISTS "Viewers can view people" ON public.people;

CREATE POLICY "Project users can view people"
  ON public.people
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.community_can_access_shared_directory(project_id, 'view')
  );

CREATE POLICY "Project users can create people"
  ON public.people
  FOR INSERT
  WITH CHECK (public.community_can_access_shared_directory(project_id, 'create'));

CREATE POLICY "Project users can update people"
  ON public.people
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.community_can_access_shared_directory(project_id, 'update')
  )
  WITH CHECK (public.community_can_access_shared_directory(project_id, 'update'));

CREATE POLICY "Project users can delete people"
  ON public.people
  FOR DELETE
  USING (public.community_can_access_shared_directory(project_id, 'delete'));

DROP POLICY IF EXISTS "Members can view person-org links" ON public.person_organizations;
DROP POLICY IF EXISTS "Members can create person-org links" ON public.person_organizations;
DROP POLICY IF EXISTS "Members can update person-org links" ON public.person_organizations;
DROP POLICY IF EXISTS "Members can delete person-org links" ON public.person_organizations;
DROP POLICY IF EXISTS "Viewers can view person-org links" ON public.person_organizations;

CREATE POLICY "Project users can view person-org links"
  ON public.person_organizations
  FOR SELECT
  USING (public.community_can_access_shared_directory(project_id, 'view'));

CREATE POLICY "Project users can create person-org links"
  ON public.person_organizations
  FOR INSERT
  WITH CHECK (public.community_can_access_shared_directory(project_id, 'create'));

CREATE POLICY "Project users can update person-org links"
  ON public.person_organizations
  FOR UPDATE
  USING (public.community_can_access_shared_directory(project_id, 'update'))
  WITH CHECK (public.community_can_access_shared_directory(project_id, 'update'));

CREATE POLICY "Project users can delete person-org links"
  ON public.person_organizations
  FOR DELETE
  USING (public.community_can_access_shared_directory(project_id, 'delete'));
