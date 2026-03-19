-- ============================================================
-- Fix: create_round_robin_booking
--   1. Synced-event overlap check now includes buffers
--   2. State initialization race condition fixed (RETURNING + re-lock)
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
  -- Lock the round robin state row for this event type.
  -- Use INSERT ... ON CONFLICT DO UPDATE (not DO NOTHING) to ensure RETURNING
  -- gives us the row even on conflict, avoiding the race where a concurrent
  -- INSERT succeeds but our SELECT FOR UPDATE misses it.
  INSERT INTO public.round_robin_state (event_type_id, assignment_count)
  VALUES (p_event_type_id, '{}')
  ON CONFLICT (event_type_id) DO UPDATE SET updated_at = NOW()
  RETURNING * INTO v_state_row;

  -- Re-acquire FOR UPDATE lock (INSERT auto-locks the row, but make it explicit)
  SELECT * INTO v_state_row
  FROM public.round_robin_state
  WHERE event_type_id = p_event_type_id
  FOR UPDATE;

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

    -- Check synced events (WITH buffers — consistent with booking overlap check)
    SELECT COUNT(*) INTO v_synced_overlap
    FROM public.synced_events
    WHERE user_id = v_user_id
      AND status IN ('busy', 'out_of_office')
      AND tstzrange(start_at, end_at)
       && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

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

    -- This candidate is available — pick if lowest count (strict improvement only)
    IF v_min_count IS NULL OR v_user_count < v_min_count THEN
      v_min_count := v_user_count;
      v_best_user := v_user_id;
    ELSIF v_user_count = v_min_count
      AND v_best_user = COALESCE(v_state_row.last_assigned_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    THEN
      -- Tiebreak: replace current best only if it was the last-assigned user
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
      ),
      updated_at = NOW()
  WHERE event_type_id = p_event_type_id;

  RETURN QUERY SELECT v_booking_id, v_best_user;
END;
$$;

-- ============================================================
-- Fix: create_collective_booking
--   1. Sort member IDs before locking to prevent deadlocks
--   2. Synced-event overlap check now includes buffers
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
  v_sorted_ids UUID[];
BEGIN
  -- Sort member IDs to prevent deadlocks from inconsistent lock ordering
  SELECT array_agg(uid ORDER BY uid) INTO v_sorted_ids
  FROM unnest(p_member_user_ids) AS uid;

  -- Lock all members in sorted order
  FOREACH v_user_id IN ARRAY v_sorted_ids
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));
  END LOOP;

  -- Check ALL members are available
  FOREACH v_user_id IN ARRAY v_sorted_ids
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

    -- Check synced events (WITH buffers — consistent with booking overlap check)
    SELECT COUNT(*) INTO v_synced_overlap
    FROM public.synced_events
    WHERE user_id = v_user_id
      AND status IN ('busy', 'out_of_office')
      AND tstzrange(start_at, end_at)
       && tstzrange(p_start_at - p_buffer_before, p_end_at + p_buffer_after);

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
