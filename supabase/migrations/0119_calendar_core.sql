-- ============================================================
-- CALENDAR PROFILES — one per user, scheduling identity (user-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calendar_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  avatar_url TEXT,
  welcome_message TEXT,
  booking_page_theme JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(slug)
);

CREATE INDEX idx_calendar_profiles_user ON public.calendar_profiles(user_id);

-- ============================================================
-- AVAILABILITY SCHEDULES — named schedules per user (user-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Working Hours',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_availability_schedules_user ON public.availability_schedules(user_id);
CREATE UNIQUE INDEX idx_availability_schedules_default
  ON public.availability_schedules(user_id) WHERE is_default = true;

-- ============================================================
-- AVAILABILITY RULES — weekly recurring windows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.availability_schedules(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_rules_schedule ON public.availability_rules(schedule_id);

-- ============================================================
-- AVAILABILITY OVERRIDES — date-specific blocks or extra hours (user-scoped)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (is_available = false) OR
    (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX idx_availability_overrides_user_date ON public.availability_overrides(user_id, date);

-- ============================================================
-- EVENT TYPES — project-scoped, like Calendly event types
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,

  location_type TEXT NOT NULL DEFAULT 'video'
    CHECK (location_type IN ('video', 'phone', 'in_person', 'custom', 'ask_invitee')),
  location_value TEXT,

  buffer_before_minutes INTEGER DEFAULT 0,
  buffer_after_minutes INTEGER DEFAULT 0,
  min_notice_hours INTEGER DEFAULT 24,
  max_days_in_advance INTEGER DEFAULT 60,
  slot_interval_minutes INTEGER,

  daily_limit INTEGER,
  weekly_limit INTEGER,

  schedule_id UUID REFERENCES public.availability_schedules(id) ON DELETE SET NULL,

  requires_confirmation BOOLEAN DEFAULT false,

  custom_questions JSONB DEFAULT '[]',

  confirmation_message TEXT,
  cancellation_policy TEXT,

  scheduling_type TEXT DEFAULT 'one_on_one'
    CHECK (scheduling_type IN ('one_on_one', 'group', 'round_robin', 'collective')),
  max_attendees INTEGER DEFAULT 1,

  default_meeting_type TEXT DEFAULT 'general',

  redirect_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE INDEX idx_event_types_user ON public.event_types(user_id);
CREATE INDEX idx_event_types_project ON public.event_types(project_id);
CREATE INDEX idx_event_types_user_active ON public.event_types(user_id) WHERE is_active = true;

-- Enforce schedule_id belongs to same user
CREATE OR REPLACE FUNCTION public.validate_event_type_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.schedule_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.availability_schedules
      WHERE id = NEW.schedule_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'schedule_id must belong to the same user as the event type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_event_type_schedule_trigger
  BEFORE INSERT OR UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.validate_event_type_schedule();

-- ============================================================
-- BOOKINGS — project-scoped, created by public invitees or internal users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_phone TEXT,
  invitee_timezone TEXT,
  invitee_notes TEXT,

  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  cancellation_reason TEXT,
  cancelled_by TEXT CHECK (cancelled_by IN ('host', 'invitee', 'system')),
  rescheduled_from_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,

  location TEXT,
  meeting_url TEXT,

  responses JSONB DEFAULT '{}',

  meeting_id UUID,
  person_id UUID,
  organization_id UUID,

  cancel_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  reschedule_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  ics_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ,

  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,

  effective_block_start TIMESTAMPTZ NOT NULL,
  effective_block_end TIMESTAMPTZ NOT NULL,

  reminder_sent_24h BOOLEAN DEFAULT false,
  reminder_sent_1h BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (end_at > start_at),
  CHECK (effective_block_end > effective_block_start),
  CHECK (buffer_before_minutes >= 0),
  CHECK (buffer_after_minutes >= 0)
);

CREATE INDEX idx_bookings_event_type ON public.bookings(event_type_id);
CREATE INDEX idx_bookings_host ON public.bookings(host_user_id);
CREATE INDEX idx_bookings_project ON public.bookings(project_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_start ON public.bookings(start_at);
CREATE INDEX idx_bookings_host_start ON public.bookings(host_user_id, start_at);
CREATE INDEX idx_bookings_cancel_token ON public.bookings(cancel_token);
CREATE INDEX idx_bookings_reschedule_token ON public.bookings(reschedule_token);
CREATE INDEX idx_bookings_invitee_email ON public.bookings(invitee_email);
CREATE INDEX idx_bookings_person ON public.bookings(person_id) WHERE person_id IS NOT NULL;

-- Generated tstzrange column + GiST index for efficient overlap queries
ALTER TABLE public.bookings
  ADD COLUMN effective_block tstzrange
  GENERATED ALWAYS AS (tstzrange(effective_block_start, effective_block_end)) STORED;

CREATE INDEX idx_bookings_availability_gist
  ON public.bookings USING GIST (effective_block)
  WHERE status NOT IN ('cancelled', 'rescheduled');

CREATE INDEX idx_bookings_host_block
  ON public.bookings(host_user_id, effective_block_start, effective_block_end)
  WHERE status NOT IN ('cancelled', 'rescheduled');

-- Enforce host_user_id matches event_type.user_id and project_id
CREATE OR REPLACE FUNCTION public.validate_booking_host()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.event_types
    WHERE id = NEW.event_type_id AND user_id = NEW.host_user_id
  ) THEN
    RAISE EXCEPTION 'host_user_id must match event_type.user_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_types
    WHERE id = NEW.event_type_id AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'project_id must match event_type.project_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_booking_host_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_host();

-- Set token_expires_at automatically to start_at
CREATE OR REPLACE FUNCTION public.set_booking_token_expiry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.token_expires_at := NEW.start_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_token_expiry_trigger
  BEFORE INSERT OR UPDATE OF start_at ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_token_expiry();

-- Safety net: recompute effective_block from snapshotted buffers
CREATE OR REPLACE FUNCTION public.recompute_booking_block()
RETURNS TRIGGER AS $$
BEGIN
  NEW.effective_block_start := NEW.start_at - make_interval(mins => NEW.buffer_before_minutes);
  NEW.effective_block_end := NEW.end_at + make_interval(mins => NEW.buffer_after_minutes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recompute_booking_block_trigger
  BEFORE UPDATE OF start_at, end_at ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_booking_block();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.calendar_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar profile"
  ON public.calendar_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own availability schedules"
  ON public.availability_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own availability rules"
  ON public.availability_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.availability_schedules s
      WHERE s.id = availability_rules.schedule_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own availability overrides"
  ON public.availability_overrides FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own event types"
  ON public.event_types FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hosts can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can delete own bookings"
  ON public.bookings FOR DELETE
  USING (auth.uid() = host_user_id);

-- ============================================================
-- PUBLIC RPCs — SECURITY DEFINER functions exposing safe subsets
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_calendar_profile(p_slug TEXT)
RETURNS TABLE (
  display_name TEXT, bio TEXT, timezone TEXT, avatar_url TEXT,
  welcome_message TEXT, booking_page_theme JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cp.display_name, cp.bio, cp.timezone, cp.avatar_url,
         cp.welcome_message, cp.booking_page_theme
  FROM public.calendar_profiles cp
  WHERE cp.slug = p_slug AND cp.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_calendar_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_calendar_profile(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_event_types(p_slug TEXT)
RETURNS TABLE (
  id UUID, title TEXT, slug TEXT, description TEXT, duration_minutes INTEGER,
  color TEXT, location_type TEXT, location_value TEXT,
  custom_questions JSONB, confirmation_message TEXT, cancellation_policy TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT et.id, et.title, et.slug, et.description, et.duration_minutes,
         et.color, et.location_type, et.location_value,
         et.custom_questions, et.confirmation_message, et.cancellation_policy
  FROM public.event_types et
  JOIN public.calendar_profiles cp ON cp.user_id = et.user_id
  WHERE cp.slug = p_slug AND cp.is_active = true AND et.is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_types(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_types(TEXT) TO service_role;

-- ============================================================
-- RATE LIMITING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  UNIQUE(key, window_start)
);

CREATE INDEX idx_booking_rate_limits_key ON public.booking_rate_limits(key, window_start);

-- Rate limit upsert RPC — atomically increments attempt_count
CREATE OR REPLACE FUNCTION public.upsert_rate_limit(
  p_key TEXT,
  p_window_start TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.booking_rate_limits (key, window_start, attempt_count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET attempt_count = booking_rate_limits.attempt_count + 1
  RETURNING attempt_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_rate_limit(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_rate_limit(TEXT, TIMESTAMPTZ) TO service_role;

-- ============================================================
-- ANTI-OVERBOOKING RPC
-- ============================================================
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
  p_requires_confirmation BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_overlap_count INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_host_user_id::text));

  SELECT COUNT(*) INTO v_overlap_count
  FROM public.bookings
  WHERE host_user_id = p_host_user_id
    AND status NOT IN ('cancelled', 'rescheduled')
    AND tstzrange(effective_block_start, effective_block_end)
     && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN: This time slot is no longer available';
  END IF;

  IF p_daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.bookings
    WHERE host_user_id = p_host_user_id
      AND status IN ('confirmed', 'pending')
      AND (start_at AT TIME ZONE p_host_timezone)::date =
          (p_start_at AT TIME ZONE p_host_timezone)::date;

    IF v_daily_count >= p_daily_limit THEN
      RAISE EXCEPTION 'DAILY_LIMIT: Daily booking limit reached';
    END IF;
  END IF;

  IF p_weekly_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_weekly_count
    FROM public.bookings
    WHERE host_user_id = p_host_user_id
      AND status IN ('confirmed', 'pending')
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

REVOKE ALL ON FUNCTION public.create_booking_if_available FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_if_available TO service_role;

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
CREATE TRIGGER set_calendar_profiles_updated_at
  BEFORE UPDATE ON public.calendar_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_availability_schedules_updated_at
  BEFORE UPDATE ON public.availability_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_event_types_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
