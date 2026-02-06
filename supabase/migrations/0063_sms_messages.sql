-- ============================================================================
-- SMS Messages Table
-- Stores all SMS messages (inbound and outbound) with entity linking
-- ============================================================================

CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  telnyx_connection_id UUID NOT NULL REFERENCES telnyx_connections(id) ON DELETE CASCADE,

  -- Telnyx identifier
  telnyx_message_id TEXT,

  -- Message details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'sending', 'sent', 'delivered', 'failed', 'received'
  )),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Tracking
  segments INTEGER DEFAULT 1,
  error_code TEXT,
  error_message TEXT,

  -- Entity linking
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  rfp_id UUID REFERENCES rfps(id) ON DELETE SET NULL,

  -- Sequence tracking (optional)
  sequence_enrollment_id UUID REFERENCES sequence_enrollments(id) ON DELETE SET NULL,
  sequence_step_id UUID REFERENCES sequence_steps(id) ON DELETE SET NULL,

  -- User who sent (null for inbound)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_messages_project ON sms_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_person ON sms_messages(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_organization ON sms_messages(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_telnyx_id ON sms_messages(telnyx_message_id) WHERE telnyx_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation ON sms_messages(project_id, person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_org_conversation ON sms_messages(project_id, organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_user ON sms_messages(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_messages_created ON sms_messages(created_at DESC);

-- RLS
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project SMS"
  ON sms_messages
  FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "Members can create SMS"
  ON sms_messages
  FOR INSERT
  WITH CHECK (public.has_project_role(project_id, 'member'));

CREATE POLICY "Members can update SMS"
  ON sms_messages
  FOR UPDATE
  USING (public.has_project_role(project_id, 'member'))
  WITH CHECK (public.has_project_role(project_id, 'member'));

-- Service role policy for webhook updates (no auth context)
CREATE POLICY "Service role can manage SMS"
  ON sms_messages
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER set_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
