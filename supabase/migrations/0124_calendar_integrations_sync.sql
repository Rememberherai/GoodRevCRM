-- ============================================================
-- Phase 3: Calendar Integrations & Synced Events
-- ============================================================

-- ============================================================
-- CALENDAR INTEGRATIONS — OAuth connections to Google Calendar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  email TEXT NOT NULL,
  -- Optional link to existing Gmail connection (for reference)
  gmail_connection_id UUID REFERENCES public.gmail_connections(id) ON DELETE SET NULL,
  -- Own credential storage (calendar OAuth may have broader scopes)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  granted_scopes TEXT[],
  calendar_id TEXT DEFAULT 'primary',
  is_primary BOOLEAN DEFAULT false,
  sync_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,                          -- Google Calendar incremental sync token
  initial_sync_done BOOLEAN DEFAULT false,
  sync_errors_count INTEGER DEFAULT 0,
  last_sync_error TEXT,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX idx_calendar_integrations_user ON public.calendar_integrations(user_id);
CREATE INDEX idx_calendar_integrations_status ON public.calendar_integrations(status) WHERE status = 'connected';

-- ============================================================
-- SYNCED EVENTS — events pulled from Google Calendar (busy time)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.synced_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'busy'
    CHECK (status IN ('busy', 'free', 'tentative', 'out_of_office')),
  source_calendar TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, external_id)
);

CREATE INDEX idx_synced_events_integration ON public.synced_events(integration_id);
CREATE INDEX idx_synced_events_user ON public.synced_events(user_id);
CREATE INDEX idx_synced_events_user_time ON public.synced_events(user_id, start_at, end_at);
CREATE INDEX idx_synced_events_user_busy ON public.synced_events(user_id, start_at, end_at)
  WHERE status IN ('busy', 'out_of_office');

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar integrations"
  ON public.calendar_integrations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own synced events"
  ON public.synced_events FOR SELECT
  USING (auth.uid() = user_id);

-- Synced events are managed by service role (sync engine), not user directly
-- No INSERT/UPDATE/DELETE policy for authenticated users

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
CREATE TRIGGER set_calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_synced_events_updated_at
  BEFORE UPDATE ON public.synced_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- UPDATE create_booking_if_available to also check synced events
-- ============================================================
-- Drop the old overload without p_exclude_booking_id (from 0119) if it exists
DROP FUNCTION IF EXISTS public.create_booking_if_available(
  UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.create_booking_if_available(
  p_event_type_id UUID,
  p_host_user_id UUID,
  p_project_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_buffer_before INTERVAL,
  p_buffer_after INTERVAL,
  p_host_timezone TEXT,
  p_daily_limit INTEGER,
  p_weekly_limit INTEGER,
  p_invitee_name TEXT,
  p_invitee_email TEXT,
  p_invitee_phone TEXT,
  p_invitee_timezone TEXT,
  p_invitee_notes TEXT,
  p_location TEXT,
  p_meeting_url TEXT,
  p_responses JSONB,
  p_requires_confirmation BOOLEAN,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_overlap_count INTEGER;
  v_synced_overlap INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_host_user_id::text));

  -- Check for overlapping bookings
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.bookings
  WHERE host_user_id = p_host_user_id
    AND status NOT IN ('cancelled', 'rescheduled')
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND tstzrange(effective_block_start, effective_block_end)
     && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN: This time slot is no longer available';
  END IF;

  -- Check for overlapping synced calendar events (busy/out_of_office)
  SELECT COUNT(*) INTO v_synced_overlap
  FROM public.synced_events
  WHERE user_id = p_host_user_id
    AND status IN ('busy', 'out_of_office')
    AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at);

  IF v_synced_overlap > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN: This time slot conflicts with an external calendar event';
  END IF;

  -- Daily limit check
  IF p_daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.bookings
    WHERE host_user_id = p_host_user_id
      AND status IN ('confirmed', 'pending')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND (start_at AT TIME ZONE p_host_timezone)::date =
          (p_start_at AT TIME ZONE p_host_timezone)::date;

    IF v_daily_count >= p_daily_limit THEN
      RAISE EXCEPTION 'DAILY_LIMIT: Daily booking limit reached';
    END IF;
  END IF;

  -- Weekly limit check
  IF p_weekly_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_weekly_count
    FROM public.bookings
    WHERE host_user_id = p_host_user_id
      AND status IN ('confirmed', 'pending')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND date_trunc('week', start_at AT TIME ZONE p_host_timezone) =
          date_trunc('week', p_start_at AT TIME ZONE p_host_timezone);

    IF v_weekly_count >= p_weekly_limit THEN
      RAISE EXCEPTION 'WEEKLY_LIMIT: Weekly booking limit reached';
    END IF;
  END IF;

  v_status := CASE WHEN p_requires_confirmation THEN 'pending' ELSE 'confirmed' END;

  INSERT INTO public.bookings (
    event_type_id, host_user_id, project_id,
    start_at, end_at, status,
    buffer_before_minutes, buffer_after_minutes,
    effective_block_start, effective_block_end,
    invitee_name, invitee_email, invitee_phone, invitee_timezone, invitee_notes,
    location, meeting_url, responses
  ) VALUES (
    p_event_type_id, p_host_user_id, p_project_id,
    p_start_at, p_end_at, v_status,
    EXTRACT(EPOCH FROM p_buffer_before)::integer / 60,
    EXTRACT(EPOCH FROM p_buffer_after)::integer / 60,
    p_start_at - p_buffer_before, p_end_at + p_buffer_after,
    p_invitee_name, p_invitee_email, p_invitee_phone, p_invitee_timezone, p_invitee_notes,
    p_location, p_meeting_url, p_responses
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_if_available(
  UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_if_available(
  UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID
) TO service_role;
