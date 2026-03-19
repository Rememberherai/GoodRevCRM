-- ============================================================
-- Phase 4: Team Scheduling — event_type_members + round_robin_state
-- ============================================================

-- ============================================================
-- EVENT TYPE MEMBERS — team members assigned to an event type
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_type_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_type_id, user_id)
);

CREATE INDEX idx_event_type_members_event_type ON public.event_type_members(event_type_id);
CREATE INDEX idx_event_type_members_user ON public.event_type_members(user_id);

-- ============================================================
-- ROUND ROBIN STATE — tracks assignment distribution
-- ============================================================
CREATE TABLE IF NOT EXISTS public.round_robin_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  last_assigned_user_id UUID REFERENCES public.users(id),
  assignment_count JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_type_id)
);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.event_type_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_robin_state ENABLE ROW LEVEL SECURITY;

-- Event type members: event type owner can manage
CREATE POLICY "Event type owner can manage members"
  ON public.event_type_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_types et
      WHERE et.id = event_type_members.event_type_id
        AND et.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_types et
      WHERE et.id = event_type_members.event_type_id
        AND et.user_id = auth.uid()
    )
  );

-- Project members can view event type members (for team visibility)
CREATE POLICY "Project members can view event type members"
  ON public.event_type_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_types et
      JOIN public.project_memberships pm ON pm.project_id = et.project_id
      WHERE et.id = event_type_members.event_type_id
        AND pm.user_id = auth.uid()
    )
  );

-- Round robin state: event type owner can view
CREATE POLICY "Event type owner can view round robin state"
  ON public.round_robin_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_types et
      WHERE et.id = round_robin_state.event_type_id
        AND et.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGER for updated_at on round_robin_state
-- ============================================================
CREATE TRIGGER set_round_robin_state_updated_at
  BEFORE UPDATE ON public.round_robin_state
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RPC: create_round_robin_booking — atomic assignment + booking
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_round_robin_booking(
  p_event_type_id UUID,
  p_project_id UUID,
  p_candidate_user_ids UUID[],
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
RETURNS TABLE(booking_id UUID, assigned_user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_booking_id UUID;
  v_overlap_count INTEGER;
  v_synced_overlap INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_status TEXT;
  v_state_row round_robin_state%ROWTYPE;
  v_counts JSONB;
  v_min_count INTEGER;
  v_best_user UUID;
  v_user_count INTEGER;
BEGIN
  -- Lock the round robin state row for this event type
  SELECT * INTO v_state_row
  FROM public.round_robin_state
  WHERE event_type_id = p_event_type_id
  FOR UPDATE;

  -- If no state row exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.round_robin_state (event_type_id, assignment_count)
    VALUES (p_event_type_id, '{}')
    ON CONFLICT (event_type_id) DO NOTHING;

    SELECT * INTO v_state_row
    FROM public.round_robin_state
    WHERE event_type_id = p_event_type_id
    FOR UPDATE;
  END IF;

  v_counts := COALESCE(v_state_row.assignment_count, '{}');
  v_min_count := NULL;
  v_best_user := NULL;

  -- Find the best available candidate
  FOR v_user_id IN SELECT unnest(p_candidate_user_ids)
  LOOP
    v_user_count := COALESCE((v_counts ->> v_user_id::text)::integer, 0);

    -- Check for booking overlap
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.bookings
    WHERE host_user_id = v_user_id
      AND status NOT IN ('cancelled', 'rescheduled')
      AND tstzrange(effective_block_start, effective_block_end)
       && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

    IF v_overlap_count > 0 THEN
      CONTINUE;
    END IF;

    -- Check synced events
    SELECT COUNT(*) INTO v_synced_overlap
    FROM public.synced_events
    WHERE user_id = v_user_id
      AND status IN ('busy', 'out_of_office')
      AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at);

    IF v_synced_overlap > 0 THEN
      CONTINUE;
    END IF;

    -- Check daily limit
    IF p_daily_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_daily_count
      FROM public.bookings
      WHERE host_user_id = v_user_id
        AND status IN ('confirmed', 'pending')
        AND (start_at AT TIME ZONE p_host_timezone)::date =
            (p_start_at AT TIME ZONE p_host_timezone)::date;
      IF v_daily_count >= p_daily_limit THEN
        CONTINUE;
      END IF;
    END IF;

    -- Check weekly limit
    IF p_weekly_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_weekly_count
      FROM public.bookings
      WHERE host_user_id = v_user_id
        AND status IN ('confirmed', 'pending')
        AND date_trunc('week', start_at AT TIME ZONE p_host_timezone) =
            date_trunc('week', p_start_at AT TIME ZONE p_host_timezone);
      IF v_weekly_count >= p_weekly_limit THEN
        CONTINUE;
      END IF;
    END IF;

    -- This candidate is available — pick if lowest count or tiebreak
    IF v_min_count IS NULL
       OR v_user_count < v_min_count
       OR (v_user_count = v_min_count AND v_user_id != COALESCE(v_state_row.last_assigned_user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    THEN
      v_min_count := v_user_count;
      v_best_user := v_user_id;
    END IF;
  END LOOP;

  IF v_best_user IS NULL THEN
    RAISE EXCEPTION 'SLOT_TAKEN: No team member available for this time slot';
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
    p_event_type_id, v_best_user, p_project_id,
    p_start_at, p_end_at, v_status,
    EXTRACT(EPOCH FROM p_buffer_before)::integer / 60,
    EXTRACT(EPOCH FROM p_buffer_after)::integer / 60,
    p_start_at - p_buffer_before, p_end_at + p_buffer_after,
    p_invitee_name, p_invitee_email, p_invitee_phone, p_invitee_timezone, p_invitee_notes,
    p_location, p_meeting_url, p_responses
  ) RETURNING id INTO v_booking_id;

  -- Update round robin state
  UPDATE public.round_robin_state
  SET last_assigned_user_id = v_best_user,
      assignment_count = jsonb_set(
        v_counts,
        ARRAY[v_best_user::text],
        to_jsonb(COALESCE((v_counts ->> v_best_user::text)::integer, 0) + 1)
      )
  WHERE event_type_id = p_event_type_id;

  RETURN QUERY SELECT v_booking_id, v_best_user;
END;
$$;

REVOKE ALL ON FUNCTION public.create_round_robin_booking(
  UUID, UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_round_robin_booking(
  UUID, UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
) TO service_role;

-- ============================================================
-- RPC: create_collective_booking — check all members, book for owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_collective_booking(
  p_event_type_id UUID,
  p_host_user_id UUID,
  p_member_user_ids UUID[],
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
  v_user_id UUID;
  v_overlap_count INTEGER;
  v_synced_overlap INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_status TEXT;
BEGIN
  -- Lock all members to prevent concurrent booking
  FOREACH v_user_id IN ARRAY p_member_user_ids
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));
  END LOOP;

  -- Check ALL members are available
  FOREACH v_user_id IN ARRAY p_member_user_ids
  LOOP
    SELECT COUNT(*) INTO v_overlap_count
    FROM public.bookings
    WHERE host_user_id = v_user_id
      AND status NOT IN ('cancelled', 'rescheduled')
      AND tstzrange(effective_block_start, effective_block_end)
       && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

    IF v_overlap_count > 0 THEN
      RAISE EXCEPTION 'SLOT_TAKEN: Team member unavailable for this time slot';
    END IF;

    SELECT COUNT(*) INTO v_synced_overlap
    FROM public.synced_events
    WHERE user_id = v_user_id
      AND status IN ('busy', 'out_of_office')
      AND tstzrange(start_at, end_at) && tstzrange(p_start_at, p_end_at);

    IF v_synced_overlap > 0 THEN
      RAISE EXCEPTION 'SLOT_TAKEN: Team member has conflicting calendar event';
    END IF;
  END LOOP;

  -- Daily/weekly limits checked against primary host only
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

REVOKE ALL ON FUNCTION public.create_collective_booking(
  UUID, UUID, UUID[], UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_collective_booking(
  UUID, UUID, UUID[], UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTERVAL, INTERVAL,
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN
) TO service_role;
