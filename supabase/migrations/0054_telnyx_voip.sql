-- ============================================================================
-- Telnyx VoIP Integration
-- Adds telnyx_connections (per-project credentials) and calls (call records)
-- tables, plus a get_call_metrics() RPC function for analytics.
-- ============================================================================

-- ============================================================================
-- PART 1: telnyx_connections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS telnyx_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Telnyx credentials
  api_key TEXT NOT NULL,
  sip_connection_id TEXT,
  sip_username TEXT,
  sip_password TEXT,

  -- Phone number config
  phone_number TEXT NOT NULL,
  phone_number_id TEXT,

  -- Call settings
  record_calls BOOLEAN NOT NULL DEFAULT false,
  amd_enabled BOOLEAN NOT NULL DEFAULT false,
  caller_id_name TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  error_message TEXT,
  last_call_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Each project can have one active Telnyx connection
CREATE UNIQUE INDEX IF NOT EXISTS idx_telnyx_connections_project_active
  ON telnyx_connections(project_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_telnyx_connections_project ON telnyx_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_telnyx_connections_status ON telnyx_connections(status);

ALTER TABLE telnyx_connections ENABLE ROW LEVEL SECURITY;

-- RLS: project members can view
CREATE POLICY "Members can view telnyx connections"
  ON telnyx_connections
  FOR SELECT
  USING (public.is_project_member(project_id));

-- RLS: admins can create
CREATE POLICY "Admins can create telnyx connections"
  ON telnyx_connections
  FOR INSERT
  WITH CHECK (public.has_project_role(project_id, 'admin'));

-- RLS: admins can update
CREATE POLICY "Admins can update telnyx connections"
  ON telnyx_connections
  FOR UPDATE
  USING (public.has_project_role(project_id, 'admin'))
  WITH CHECK (public.has_project_role(project_id, 'admin'));

-- RLS: admins can delete
CREATE POLICY "Admins can delete telnyx connections"
  ON telnyx_connections
  FOR DELETE
  USING (public.has_project_role(project_id, 'admin'));

CREATE TRIGGER set_telnyx_connections_updated_at
  BEFORE UPDATE ON telnyx_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- PART 2: calls table
-- ============================================================================

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  telnyx_connection_id UUID NOT NULL REFERENCES telnyx_connections(id) ON DELETE CASCADE,

  -- Telnyx identifiers
  telnyx_call_control_id TEXT,
  telnyx_call_leg_id TEXT,
  telnyx_call_session_id TEXT,

  -- Call details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'ringing', 'answered', 'hangup',
    'failed', 'busy', 'no_answer', 'machine_detected'
  )),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  talk_time_seconds INTEGER,

  -- AMD result
  amd_result TEXT CHECK (amd_result IN ('human', 'machine', 'not_sure', 'fax')),

  -- Recording
  recording_enabled BOOLEAN DEFAULT false,
  recording_url TEXT,
  recording_duration_seconds INTEGER,

  -- Disposition (filled by user after call)
  disposition TEXT CHECK (disposition IN (
    'no_answer', 'left_voicemail', 'busy', 'wrong_number',
    'quality_conversation', 'meeting_booked', 'not_interested',
    'call_back_later', 'do_not_call', 'other'
  )),
  disposition_notes TEXT,

  -- Entity linking
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,

  -- User who made/received the call
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calls_project ON calls(project_id);
CREATE INDEX IF NOT EXISTS idx_calls_person ON calls(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_organization ON calls(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_user ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_telnyx_call_control ON calls(telnyx_call_control_id) WHERE telnyx_call_control_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_project_person ON calls(project_id, person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_project_user_started ON calls(project_id, user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_project_started ON calls(project_id, started_at DESC);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- RLS: members can view calls in their projects
CREATE POLICY "Members can view project calls"
  ON calls
  FOR SELECT
  USING (public.is_project_member(project_id));

-- RLS: members can create calls
CREATE POLICY "Members can create calls"
  ON calls
  FOR INSERT
  WITH CHECK (public.has_project_role(project_id, 'member'));

-- RLS: members can update calls
CREATE POLICY "Members can update calls"
  ON calls
  FOR UPDATE
  USING (public.has_project_role(project_id, 'member'))
  WITH CHECK (public.has_project_role(project_id, 'member'));

-- Service role policy for webhook updates (no auth context)
CREATE POLICY "Service role can manage calls"
  ON calls
  FOR ALL
  USING (auth.role() = 'service_role');

-- Also allow service role to manage connections (for webhook lookups)
CREATE POLICY "Service role can read telnyx connections"
  ON telnyx_connections
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE TRIGGER set_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- PART 3: Call metrics RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_call_metrics(
  p_project_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_calls', COUNT(*),
    'outbound_calls', COUNT(*) FILTER (WHERE direction = 'outbound'),
    'inbound_calls', COUNT(*) FILTER (WHERE direction = 'inbound'),
    'answered_calls', COUNT(*) FILTER (WHERE status = 'hangup' AND answered_at IS NOT NULL),
    'missed_calls', COUNT(*) FILTER (WHERE status IN ('no_answer', 'busy', 'failed')),
    'total_talk_time_seconds', COALESCE(SUM(talk_time_seconds), 0),
    'avg_talk_time_seconds', ROUND(COALESCE(AVG(talk_time_seconds) FILTER (WHERE talk_time_seconds > 0), 0)::numeric, 1),
    'meetings_booked', COUNT(*) FILTER (WHERE disposition = 'meeting_booked'),
    'quality_conversations', COUNT(*) FILTER (WHERE disposition = 'quality_conversation'),
    'voicemails_left', COUNT(*) FILTER (WHERE disposition = 'left_voicemail'),
    'connect_rate', CASE
      WHEN COUNT(*) FILTER (WHERE direction = 'outbound') > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE status = 'hangup' AND answered_at IS NOT NULL AND direction = 'outbound')::NUMERIC /
        COUNT(*) FILTER (WHERE direction = 'outbound') * 100, 1
      )
      ELSE 0
    END,
    'calls_by_disposition', COALESCE((
      SELECT json_agg(json_build_object('disposition', d.disposition, 'count', d.cnt))
      FROM (
        SELECT c2.disposition, COUNT(*) as cnt
        FROM calls c2
        WHERE c2.project_id = p_project_id
          AND c2.started_at >= p_start_date AND c2.started_at <= p_end_date
          AND c2.disposition IS NOT NULL
          AND (p_user_id IS NULL OR c2.user_id = p_user_id)
        GROUP BY c2.disposition ORDER BY cnt DESC
      ) d
    ), '[]'::json),
    'calls_by_day', COALESCE((
      SELECT json_agg(json_build_object('date', d.day, 'count', d.cnt))
      FROM (
        SELECT DATE(c3.started_at) as day, COUNT(*) as cnt
        FROM calls c3
        WHERE c3.project_id = p_project_id
          AND c3.started_at >= p_start_date AND c3.started_at <= p_end_date
          AND (p_user_id IS NULL OR c3.user_id = p_user_id)
        GROUP BY DATE(c3.started_at) ORDER BY day
      ) d
    ), '[]'::json)
  ) INTO result
  FROM calls
  WHERE project_id = p_project_id
    AND started_at >= p_start_date AND started_at <= p_end_date
    AND (p_user_id IS NULL OR user_id = p_user_id);

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
