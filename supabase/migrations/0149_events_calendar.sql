-- Events Calendar: public-facing event management with registration, ticketing,
-- recurrence (series), waivers, and attendance tracking.

-- ============================================================
-- 1. Storage bucket for event cover images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload event covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-covers');

CREATE POLICY "Authenticated users can update event covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-covers')
WITH CHECK (bucket_id = 'event-covers');

CREATE POLICY "Authenticated users can delete event covers"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-covers');

CREATE POLICY "Public read access for event covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-covers');

-- ============================================================
-- 2. Tables
-- ============================================================

-- 2.1 event_calendar_settings (1:1 per project)
CREATE TABLE IF NOT EXISTS public.event_calendar_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Events',
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_calendar_settings_project_id_key UNIQUE (project_id),
  CONSTRAINT event_calendar_settings_slug_key UNIQUE (slug),
  CONSTRAINT event_calendar_settings_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

-- 2.2 event_series (recurrence template)
CREATE TABLE IF NOT EXISTS public.event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  description_html TEXT,

  recurrence_frequency TEXT NOT NULL CHECK (recurrence_frequency IN ('daily','weekly','biweekly','monthly')),
  recurrence_days_of_week TEXT[] DEFAULT '{}',
  recurrence_interval INTEGER NOT NULL DEFAULT 1,
  recurrence_until DATE,
  recurrence_count INTEGER,
  recurrence_day_position INTEGER,

  template_start_time TIME NOT NULL,
  template_end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  location_type TEXT NOT NULL DEFAULT 'in_person'
    CHECK (location_type IN ('in_person','virtual','hybrid')),
  venue_name TEXT,
  venue_address TEXT,
  venue_latitude DOUBLE PRECISION,
  venue_longitude DOUBLE PRECISION,
  virtual_url TEXT,

  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  total_capacity INTEGER,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_tickets_per_registration INTEGER NOT NULL DEFAULT 10,
  require_approval BOOLEAN NOT NULL DEFAULT FALSE,
  custom_questions JSONB NOT NULL DEFAULT '[]'::JSONB,

  cover_image_url TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','unlisted','private')),

  confirmation_message TEXT,
  cancellation_policy TEXT,
  requires_waiver BOOLEAN NOT NULL DEFAULT FALSE,
  organizer_name TEXT,
  organizer_email TEXT,

  last_generated_date DATE,
  generation_horizon_days INTEGER NOT NULL DEFAULT 90,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 event_series_registrations (whole-series registration)
CREATE TABLE IF NOT EXISTS public.event_series_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,

  registrant_name TEXT NOT NULL,
  registrant_email TEXT NOT NULL,
  registrant_phone TEXT,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','cancelled')),

  responses JSONB NOT NULL DEFAULT '{}'::JSONB,

  cancel_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  source TEXT DEFAULT 'web'
    CHECK (source IN ('web','embed','api','manual','import')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  series_id UUID REFERENCES public.event_series(id) ON DELETE SET NULL,
  series_index INTEGER,
  series_instance_modified BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  description_html TEXT,
  cover_image_url TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,

  location_type TEXT NOT NULL DEFAULT 'in_person'
    CHECK (location_type IN ('in_person','virtual','hybrid')),
  venue_name TEXT,
  venue_address TEXT,
  venue_latitude DOUBLE PRECISION,
  venue_longitude DOUBLE PRECISION,
  virtual_url TEXT,

  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  total_capacity INTEGER,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_tickets_per_registration INTEGER NOT NULL DEFAULT 10,
  require_approval BOOLEAN NOT NULL DEFAULT FALSE,
  add_to_crm BOOLEAN NOT NULL DEFAULT TRUE,
  custom_questions JSONB NOT NULL DEFAULT '[]'::JSONB,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','cancelled','postponed','completed')),
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','unlisted','private')),
  published_at TIMESTAMPTZ,

  organizer_name TEXT,
  organizer_email TEXT,

  confirmation_message TEXT,
  cancellation_policy TEXT,
  requires_waiver BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT events_project_slug_key UNIQUE (project_id, slug),
  CONSTRAINT events_dates_check CHECK (ends_at > starts_at),
  CONSTRAINT events_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT events_capacity_positive CHECK (total_capacity IS NULL OR total_capacity > 0)
);

-- 2.5 event_ticket_types
CREATE TABLE IF NOT EXISTS public.event_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  quantity_available INTEGER,
  max_per_order INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  sales_start_at TIMESTAMPTZ,
  sales_end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT event_ticket_types_price_check CHECK (price_cents >= 0),
  CONSTRAINT event_ticket_types_quantity_check CHECK (quantity_available IS NULL OR quantity_available > 0)
);

-- 2.6 event_registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  series_registration_id UUID REFERENCES public.event_series_registrations(id) ON DELETE SET NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,

  registrant_name TEXT NOT NULL,
  registrant_email TEXT NOT NULL,
  registrant_phone TEXT,

  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending_approval','pending_waiver','confirmed','waitlisted','cancelled')),

  responses JSONB NOT NULL DEFAULT '{}'::JSONB,

  confirmation_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  cancel_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  waiver_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (waiver_status IN ('not_required','pending','signed')),
  waiver_signed_at TIMESTAMPTZ,

  reminder_sent_24h BOOLEAN DEFAULT FALSE,
  reminder_sent_1h BOOLEAN DEFAULT FALSE,

  source TEXT DEFAULT 'web'
    CHECK (source IN ('web','embed','api','manual','import')),
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 event_registration_tickets
CREATE TABLE IF NOT EXISTS public.event_registration_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES public.event_ticket_types(id) ON DELETE RESTRICT,
  attendee_name TEXT,
  attendee_email TEXT,
  qr_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 event_waivers (join table: events <-> contract_templates)
CREATE TABLE IF NOT EXISTS public.event_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, template_id)
);

-- 2.9 registration_waivers (per-registration per-waiver signing status)
CREATE TABLE IF NOT EXISTS public.registration_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_waiver_id UUID NOT NULL REFERENCES public.event_waivers(id) ON DELETE CASCADE,
  contract_document_id UUID REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(registration_id, event_waiver_id)
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_series_project ON public.event_series(project_id);
CREATE INDEX IF NOT EXISTS idx_event_series_program ON public.event_series(program_id);
CREATE INDEX IF NOT EXISTS idx_event_series_reg_series ON public.event_series_registrations(series_id);
CREATE INDEX IF NOT EXISTS idx_event_series_reg_email ON public.event_series_registrations(registrant_email);
CREATE INDEX IF NOT EXISTS idx_events_project_status ON public.events(project_id, status);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_program_id ON public.events(program_id);
CREATE INDEX IF NOT EXISTS idx_events_series_id ON public.events(series_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event ON public.event_ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON public.event_registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_registrations_email ON public.event_registrations(registrant_email);
CREATE INDEX IF NOT EXISTS idx_event_registrations_person ON public.event_registrations(person_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_cancel_token ON public.event_registrations(cancel_token);
CREATE INDEX IF NOT EXISTS idx_event_registrations_confirmation_token ON public.event_registrations(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_event_reg_tickets_registration ON public.event_registration_tickets(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_tickets_qr ON public.event_registration_tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_event_waivers_event ON public.event_waivers(event_id);
CREATE INDEX IF NOT EXISTS idx_registration_waivers_registration ON public.registration_waivers(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_waivers_contract ON public.registration_waivers(contract_document_id);

-- ============================================================
-- 4. Triggers (updated_at)
-- ============================================================
CREATE TRIGGER set_event_calendar_settings_updated_at
  BEFORE UPDATE ON public.event_calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_event_series_updated_at
  BEFORE UPDATE ON public.event_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_event_series_registrations_updated_at
  BEFORE UPDATE ON public.event_series_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_event_ticket_types_updated_at
  BEFORE UPDATE ON public.event_ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_event_waivers_updated_at
  BEFORE UPDATE ON public.event_waivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_registration_waivers_updated_at
  BEFORE UPDATE ON public.registration_waivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. Auto-sync events.requires_waiver from event_waivers rows
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_event_requires_waiver()
RETURNS TRIGGER AS $$
DECLARE
  target_event_id UUID;
BEGIN
  target_event_id := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.events
  SET requires_waiver = EXISTS(
    SELECT 1 FROM public.event_waivers WHERE event_id = target_event_id
  )
  WHERE id = target_event_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_event_requires_waiver
  AFTER INSERT OR DELETE ON public.event_waivers
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_requires_waiver();

-- ============================================================
-- 6. Alter existing tables
-- ============================================================

-- 6.1 Extend notes table with event_id + category
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_notes_event_id ON public.notes(event_id);

-- 6.2 Extend notifications CHECK constraint to add event_registration and event_reminder
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'task_assigned', 'task_due', 'task_overdue', 'task_completed',
      'opportunity_assigned', 'opportunity_won', 'opportunity_lost', 'opportunity_stage_changed',
      'mention', 'comment', 'reply',
      'email_received', 'email_opened', 'email_replied',
      'meeting_reminder', 'meeting_scheduled',
      'import_completed', 'export_ready',
      'team_invite', 'team_member_joined',
      'system', 'custom', 'automation',
      'event_registration', 'event_reminder'
    ));
END $$;

-- ============================================================
-- 7. Update community_has_permission() to add 'events' resource
-- ============================================================
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

-- ============================================================
-- 8. RLS policies
-- ============================================================
ALTER TABLE public.event_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_series_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registration_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_waivers ENABLE ROW LEVEL SECURITY;

-- Service-role bypass policies
CREATE POLICY service_role_event_calendar_settings ON public.event_calendar_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_event_series ON public.event_series FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_event_series_registrations ON public.event_series_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_events ON public.events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_event_ticket_types ON public.event_ticket_types FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_event_registrations ON public.event_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_event_registration_tickets ON public.event_registration_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_event_waivers ON public.event_waivers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_registration_waivers ON public.registration_waivers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated access policies using community_has_permission
DROP POLICY IF EXISTS event_calendar_settings_access ON public.event_calendar_settings;
CREATE POLICY event_calendar_settings_access ON public.event_calendar_settings
  FOR ALL TO authenticated
  USING (public.community_has_permission(project_id, 'events', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'events', 'manage'));

DROP POLICY IF EXISTS event_series_access ON public.event_series;
CREATE POLICY event_series_access ON public.event_series
  FOR ALL TO authenticated
  USING (public.community_has_permission(project_id, 'events', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'events', 'create'));

DROP POLICY IF EXISTS event_series_registrations_access ON public.event_series_registrations;
CREATE POLICY event_series_registrations_access ON public.event_series_registrations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_series es
      WHERE es.id = series_id
        AND public.community_has_permission(es.project_id, 'events', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_series es
      WHERE es.id = series_id
        AND public.community_has_permission(es.project_id, 'events', 'create')
    )
  );

DROP POLICY IF EXISTS events_access ON public.events;
CREATE POLICY events_access ON public.events
  FOR ALL TO authenticated
  USING (public.community_has_permission(project_id, 'events', 'view'))
  WITH CHECK (public.community_has_permission(project_id, 'events', 'create'));

DROP POLICY IF EXISTS event_ticket_types_access ON public.event_ticket_types;
CREATE POLICY event_ticket_types_access ON public.event_ticket_types
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.community_has_permission(e.project_id, 'events', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.community_has_permission(e.project_id, 'events', 'create')
    )
  );

DROP POLICY IF EXISTS event_registrations_access ON public.event_registrations;
CREATE POLICY event_registrations_access ON public.event_registrations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.community_has_permission(e.project_id, 'events', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.community_has_permission(e.project_id, 'events', 'create')
    )
  );

DROP POLICY IF EXISTS event_registration_tickets_access ON public.event_registration_tickets;
CREATE POLICY event_registration_tickets_access ON public.event_registration_tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_registrations er
      JOIN public.events e ON e.id = er.event_id
      WHERE er.id = registration_id
        AND public.community_has_permission(e.project_id, 'events', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_registrations er
      JOIN public.events e ON e.id = er.event_id
      WHERE er.id = registration_id
        AND public.community_has_permission(e.project_id, 'events', 'create')
    )
  );

DROP POLICY IF EXISTS event_waivers_access ON public.event_waivers;
CREATE POLICY event_waivers_access ON public.event_waivers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.community_has_permission(e.project_id, 'events', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND public.community_has_permission(e.project_id, 'events', 'create')
    )
  );

DROP POLICY IF EXISTS registration_waivers_access ON public.registration_waivers;
CREATE POLICY registration_waivers_access ON public.registration_waivers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_waivers ew
      JOIN public.events e ON e.id = ew.event_id
      WHERE ew.id = event_waiver_id
        AND public.community_has_permission(e.project_id, 'events', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_waivers ew
      JOIN public.events e ON e.id = ew.event_id
      WHERE ew.id = event_waiver_id
        AND public.community_has_permission(e.project_id, 'events', 'create')
    )
  );

-- ============================================================
-- 9. RPCs
-- ============================================================

-- 9.1 register_for_event: atomic registration with capacity check
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id UUID,
  p_registrant_name TEXT,
  p_registrant_email TEXT,
  p_registrant_phone TEXT,
  p_ticket_selections JSONB,
  p_responses JSONB,
  p_source TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_registration_id UUID;
  v_status TEXT;
  v_total_registered INTEGER;
  v_ticket_sel RECORD;
  v_ticket_type RECORD;
  v_total_tickets INTEGER := 0;
  v_sold INTEGER;
BEGIN
  -- 1. Early validation BEFORE lock
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND: Event does not exist';
  END IF;
  IF v_event.status != 'published' THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND: Event is not available for registration';
  END IF;
  IF v_event.registration_enabled = FALSE THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: Registration is disabled for this event';
  END IF;
  IF v_event.registration_opens_at IS NOT NULL AND NOW() < v_event.registration_opens_at THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: Registration has not opened yet';
  END IF;
  IF v_event.registration_closes_at IS NOT NULL AND NOW() > v_event.registration_closes_at THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED: Registration has closed';
  END IF;

  IF p_ticket_selections IS NULL OR jsonb_array_length(p_ticket_selections) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT: At least one ticket must be selected';
  END IF;

  -- Validate ticket_type_ids belong to this event
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_ticket_selections) AS sel
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_ticket_types
      WHERE id = (sel->>'ticket_type_id')::UUID AND event_id = p_event_id
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_TICKET_TYPE: One or more ticket types do not belong to this event';
  END IF;

  -- 2. Advisory lock
  PERFORM pg_advisory_xact_lock(hashtext(p_event_id::text));

  -- 3. Count existing tickets (not registrations)
  SELECT COUNT(*) INTO v_total_registered
  FROM public.event_registration_tickets ert
  JOIN public.event_registrations er ON er.id = ert.registration_id
  WHERE er.event_id = p_event_id AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver');

  -- Calculate total tickets requested
  SELECT COALESCE(SUM((sel->>'quantity')::INTEGER), 0) INTO v_total_tickets
  FROM jsonb_array_elements(p_ticket_selections) AS sel;

  -- 4. Per-ticket-type availability check
  FOR v_ticket_sel IN
    SELECT value AS sel FROM jsonb_array_elements(p_ticket_selections)
  LOOP
    SELECT * INTO v_ticket_type FROM public.event_ticket_types
    WHERE id = (v_ticket_sel.sel->>'ticket_type_id')::UUID;

    IF v_ticket_type IS NULL THEN
      RAISE EXCEPTION 'INVALID_TICKET_TYPE: Ticket type not found';
    END IF;

    IF NOT v_ticket_type.is_active THEN
      RAISE EXCEPTION 'TICKET_SOLD_OUT: Ticket type "%" is not available', v_ticket_type.name;
    END IF;

    IF v_ticket_type.sales_start_at IS NOT NULL AND NOW() < v_ticket_type.sales_start_at THEN
      RAISE EXCEPTION 'TICKET_SOLD_OUT: Ticket type "%" is not yet on sale', v_ticket_type.name;
    END IF;
    IF v_ticket_type.sales_end_at IS NOT NULL AND NOW() > v_ticket_type.sales_end_at THEN
      RAISE EXCEPTION 'TICKET_SOLD_OUT: Ticket type "%" sales have ended', v_ticket_type.name;
    END IF;

    IF v_ticket_type.quantity_available IS NOT NULL THEN
      SELECT COALESCE(COUNT(*), 0) INTO v_sold
      FROM public.event_registration_tickets ert
      JOIN public.event_registrations er ON er.id = ert.registration_id
      WHERE ert.ticket_type_id = v_ticket_type.id
        AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver');

      IF v_sold + (v_ticket_sel.sel->>'quantity')::INTEGER > v_ticket_type.quantity_available THEN
        RAISE EXCEPTION 'TICKET_SOLD_OUT: Not enough "%" tickets available', v_ticket_type.name;
      END IF;
    END IF;

    IF (v_ticket_sel.sel->>'quantity')::INTEGER > v_ticket_type.max_per_order THEN
      RAISE EXCEPTION 'INVALID_INPUT: Maximum % tickets per order for "%"', v_ticket_type.max_per_order, v_ticket_type.name;
    END IF;
  END LOOP;

  -- 4b. Event-level max_tickets_per_registration
  IF v_total_tickets > v_event.max_tickets_per_registration THEN
    RAISE EXCEPTION 'INVALID_INPUT: Maximum % tickets per registration', v_event.max_tickets_per_registration;
  END IF;

  -- 5. Determine status (priority order)
  IF v_event.total_capacity IS NOT NULL AND v_total_registered + v_total_tickets > v_event.total_capacity THEN
    IF v_event.waitlist_enabled THEN
      v_status := 'waitlisted';
    ELSE
      RAISE EXCEPTION 'CAPACITY_FULL: This event is at full capacity';
    END IF;
  ELSIF v_event.require_approval THEN
    v_status := 'pending_approval';
  ELSIF v_event.requires_waiver THEN
    v_status := 'pending_waiver';
  ELSE
    v_status := 'confirmed';
  END IF;

  -- 6. INSERT registration
  INSERT INTO public.event_registrations (
    event_id, registrant_name, registrant_email, registrant_phone,
    status, responses, source, ip_address, user_agent,
    waiver_status
  ) VALUES (
    p_event_id, p_registrant_name, p_registrant_email, p_registrant_phone,
    v_status, COALESCE(p_responses, '{}'::JSONB), COALESCE(p_source, 'web'),
    p_ip_address, p_user_agent,
    CASE WHEN v_event.requires_waiver THEN 'pending' ELSE 'not_required' END
  ) RETURNING id INTO v_registration_id;

  -- 7. INSERT tickets
  INSERT INTO public.event_registration_tickets (registration_id, ticket_type_id, attendee_name, attendee_email)
  SELECT
    v_registration_id,
    (sel->>'ticket_type_id')::UUID,
    sel->>'attendee_name',
    sel->>'attendee_email'
  FROM jsonb_array_elements(p_ticket_selections) AS sel,
       generate_series(1, (sel->>'quantity')::INTEGER);

  -- 8. Return registration ID
  RETURN v_registration_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT) TO service_role;

-- 9.2 get_public_events: public event listing by calendar slug
CREATE OR REPLACE FUNCTION public.get_public_events(p_calendar_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_settings
  FROM public.event_calendar_settings
  WHERE slug = p_calendar_slug AND is_enabled = TRUE;

  IF v_settings IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(ev)::JSONB), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      e.id, e.title, e.slug, e.description, e.cover_image_url, e.category, e.tags,
      e.starts_at, e.ends_at, e.timezone, e.is_all_day,
      e.location_type, e.venue_name, e.venue_address, e.venue_latitude, e.venue_longitude,
      e.virtual_url,
      e.registration_enabled, e.registration_opens_at, e.registration_closes_at,
      e.total_capacity, e.waitlist_enabled, e.requires_waiver,
      e.organizer_name, e.organizer_email,
      e.confirmation_message, e.cancellation_policy,
      e.series_id, e.program_id,
      (SELECT COUNT(*)
       FROM public.event_registration_tickets ert
       JOIN public.event_registrations er ON er.id = ert.registration_id
       WHERE er.event_id = e.id AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver')
      ) AS registered_count,
      CASE WHEN e.total_capacity IS NOT NULL THEN
        GREATEST(0, e.total_capacity - (
          SELECT COUNT(*)
          FROM public.event_registration_tickets ert
          JOIN public.event_registrations er ON er.id = ert.registration_id
          WHERE er.event_id = e.id AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver')
        ))
      ELSE NULL END AS remaining_capacity
    FROM public.events e
    WHERE e.project_id = v_settings.project_id
      AND e.status = 'published'
      AND e.visibility = 'public'
      AND e.starts_at > NOW() - INTERVAL '1 day'
    ORDER BY e.starts_at
  ) ev;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_events(TEXT) TO service_role;

-- 9.3 get_public_event_detail: single event with ticket types
CREATE OR REPLACE FUNCTION public.get_public_event_detail(p_calendar_slug TEXT, p_event_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_event RECORD;
  v_result JSONB;
  v_ticket_types JSONB;
BEGIN
  SELECT * INTO v_settings
  FROM public.event_calendar_settings
  WHERE slug = p_calendar_slug AND is_enabled = TRUE;

  IF v_settings IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE project_id = v_settings.project_id
    AND slug = p_event_slug
    AND status = 'published'
    AND visibility IN ('public', 'unlisted');

  IF v_event IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get active ticket types with remaining counts
  SELECT COALESCE(jsonb_agg(row_to_json(tt)::JSONB), '[]'::JSONB)
  INTO v_ticket_types
  FROM (
    SELECT
      t.id, t.name, t.description, t.price_cents, t.currency,
      t.quantity_available, t.max_per_order, t.sort_order,
      t.sales_start_at, t.sales_end_at,
      CASE WHEN t.quantity_available IS NOT NULL THEN
        GREATEST(0, t.quantity_available - (
          SELECT COUNT(*)
          FROM public.event_registration_tickets ert
          JOIN public.event_registrations er ON er.id = ert.registration_id
          WHERE ert.ticket_type_id = t.id
            AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver')
        ))
      ELSE NULL END AS remaining
    FROM public.event_ticket_types t
    WHERE t.event_id = v_event.id AND t.is_active = TRUE AND t.is_hidden = FALSE
    ORDER BY t.sort_order
  ) tt;

  v_result := jsonb_build_object(
    'id', v_event.id,
    'title', v_event.title,
    'slug', v_event.slug,
    'description', v_event.description,
    'description_html', v_event.description_html,
    'cover_image_url', v_event.cover_image_url,
    'category', v_event.category,
    'tags', v_event.tags,
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'timezone', v_event.timezone,
    'is_all_day', v_event.is_all_day,
    'location_type', v_event.location_type,
    'venue_name', v_event.venue_name,
    'venue_address', v_event.venue_address,
    'venue_latitude', v_event.venue_latitude,
    'venue_longitude', v_event.venue_longitude,
    'virtual_url', v_event.virtual_url,
    'registration_enabled', v_event.registration_enabled,
    'registration_opens_at', v_event.registration_opens_at,
    'registration_closes_at', v_event.registration_closes_at,
    'total_capacity', v_event.total_capacity,
    'waitlist_enabled', v_event.waitlist_enabled,
    'max_tickets_per_registration', v_event.max_tickets_per_registration,
    'requires_waiver', v_event.requires_waiver,
    'require_approval', v_event.require_approval,
    'custom_questions', v_event.custom_questions,
    'organizer_name', v_event.organizer_name,
    'organizer_email', v_event.organizer_email,
    'confirmation_message', v_event.confirmation_message,
    'cancellation_policy', v_event.cancellation_policy,
    'series_id', v_event.series_id,
    'program_id', v_event.program_id,
    'ticket_types', v_ticket_types,
    'registered_count', (
      SELECT COUNT(*)
      FROM public.event_registration_tickets ert
      JOIN public.event_registrations er ON er.id = ert.registration_id
      WHERE er.event_id = v_event.id AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver')
    ),
    'remaining_capacity', CASE WHEN v_event.total_capacity IS NOT NULL THEN
      GREATEST(0, v_event.total_capacity - (
        SELECT COUNT(*)
        FROM public.event_registration_tickets ert
        JOIN public.event_registrations er ON er.id = ert.registration_id
        WHERE er.event_id = v_event.id AND er.status IN ('confirmed', 'pending_approval', 'pending_waiver')
      ))
    ELSE NULL END
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_detail(TEXT, TEXT) TO service_role;
