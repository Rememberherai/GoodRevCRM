-- Repair migration for calendar core after the initial schema was already applied.
-- This backfills booking buffer/block fields, recreates the safety triggers,
-- and updates the booking/rate-limit RPCs to match the current service code.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS ics_token TEXT,
  ADD COLUMN IF NOT EXISTS buffer_before_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS buffer_after_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS effective_block_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_block_end TIMESTAMPTZ;

UPDATE public.bookings
SET
  ics_token = COALESCE(ics_token, encode(gen_random_bytes(32), 'hex')),
  buffer_before_minutes = COALESCE(buffer_before_minutes, 0),
  buffer_after_minutes = COALESCE(buffer_after_minutes, 0),
  effective_block_start = COALESCE(
    effective_block_start,
    start_at - make_interval(mins => COALESCE(buffer_before_minutes, 0))
  ),
  effective_block_end = COALESCE(
    effective_block_end,
    end_at + make_interval(mins => COALESCE(buffer_after_minutes, 0))
  )
WHERE
  ics_token IS NULL
  OR buffer_before_minutes IS NULL
  OR buffer_after_minutes IS NULL
  OR effective_block_start IS NULL
  OR effective_block_end IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN ics_token SET DEFAULT encode(gen_random_bytes(32), 'hex'),
  ALTER COLUMN buffer_before_minutes SET DEFAULT 0,
  ALTER COLUMN buffer_after_minutes SET DEFAULT 0,
  ALTER COLUMN buffer_before_minutes SET NOT NULL,
  ALTER COLUMN buffer_after_minutes SET NOT NULL,
  ALTER COLUMN effective_block_start SET NOT NULL,
  ALTER COLUMN effective_block_end SET NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS effective_block tstzrange
  GENERATED ALWAYS AS (tstzrange(effective_block_start, effective_block_end)) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_end_after_start_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_end_after_start_check CHECK (end_at > start_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_effective_block_valid_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_effective_block_valid_check
      CHECK (effective_block_end > effective_block_start);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_buffer_before_nonnegative_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_buffer_before_nonnegative_check
      CHECK (buffer_before_minutes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_buffer_after_nonnegative_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_buffer_after_nonnegative_check
      CHECK (buffer_after_minutes >= 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_ics_token ON public.bookings(ics_token);
CREATE INDEX IF NOT EXISTS idx_bookings_host_block
  ON public.bookings(host_user_id, effective_block_start, effective_block_end)
  WHERE status NOT IN ('cancelled', 'rescheduled');
CREATE INDEX IF NOT EXISTS idx_bookings_availability_gist
  ON public.bookings USING GIST (effective_block)
  WHERE status NOT IN ('cancelled', 'rescheduled');

CREATE TABLE IF NOT EXISTS public.booking_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  UNIQUE(key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_booking_rate_limits_key
  ON public.booking_rate_limits(key, window_start);

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
  DO UPDATE SET attempt_count = public.booking_rate_limits.attempt_count + 1
  RETURNING attempt_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_rate_limit(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_rate_limit(TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.set_booking_token_expiry()
RETURNS TRIGGER AS $$
BEGIN
  NEW.token_expires_at := NEW.start_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_booking_token_expiry_trigger ON public.bookings;
CREATE TRIGGER set_booking_token_expiry_trigger
  BEFORE INSERT OR UPDATE OF start_at ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_token_expiry();

CREATE OR REPLACE FUNCTION public.recompute_booking_block()
RETURNS TRIGGER AS $$
BEGIN
  NEW.effective_block_start := NEW.start_at - make_interval(mins => NEW.buffer_before_minutes);
  NEW.effective_block_end := NEW.end_at + make_interval(mins => NEW.buffer_after_minutes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recompute_booking_block_trigger ON public.bookings;
CREATE TRIGGER recompute_booking_block_trigger
  BEFORE UPDATE OF start_at, end_at, buffer_before_minutes, buffer_after_minutes
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.recompute_booking_block();

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
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_host_user_id::text));

  SELECT COUNT(*) INTO v_overlap_count
  FROM public.bookings
  WHERE host_user_id = p_host_user_id
    AND status NOT IN ('cancelled', 'rescheduled')
    AND (p_exclude_booking_id IS NULL OR id <> p_exclude_booking_id)
    AND effective_block && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN: This time slot is no longer available';
  END IF;

  IF p_daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.bookings
    WHERE host_user_id = p_host_user_id
      AND status IN ('confirmed', 'pending')
      AND (p_exclude_booking_id IS NULL OR id <> p_exclude_booking_id)
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
      AND (p_exclude_booking_id IS NULL OR id <> p_exclude_booking_id)
      AND (
        date_trunc('week', (start_at AT TIME ZONE p_host_timezone) + INTERVAL '1 day') - INTERVAL '1 day'
      ) = (
        date_trunc('week', (p_start_at AT TIME ZONE p_host_timezone) + INTERVAL '1 day') - INTERVAL '1 day'
      );

    IF v_weekly_count >= p_weekly_limit THEN
      RAISE EXCEPTION 'WEEKLY_LIMIT: Weekly booking limit reached';
    END IF;
  END IF;

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
    p_host_user_id,
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

REVOKE ALL ON FUNCTION public.create_booking_if_available(
  UUID,
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  INTERVAL,
  INTERVAL,
  TEXT,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  BOOLEAN,
  UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_if_available(
  UUID,
  UUID,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  INTERVAL,
  INTERVAL,
  TEXT,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  BOOLEAN,
  UUID
) TO service_role;
