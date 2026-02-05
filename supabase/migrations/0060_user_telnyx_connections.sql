-- ============================================================================
-- Move Telnyx connections from project-level to user-level
-- A user's phone number follows them across all projects.
-- ============================================================================

-- 1. Add user_id column (nullable to preserve existing rows)
ALTER TABLE telnyx_connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 2. Make project_id nullable (user-level connections won't have a project)
ALTER TABLE telnyx_connections ALTER COLUMN project_id DROP NOT NULL;

-- 3. Unique index: one active connection per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_telnyx_connections_user_active
  ON telnyx_connections(user_id) WHERE status = 'active' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_telnyx_connections_user ON telnyx_connections(user_id) WHERE user_id IS NOT NULL;

-- 4. RLS policies for user-level connections
CREATE POLICY "Users can view own telnyx connections"
  ON telnyx_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telnyx connections"
  ON telnyx_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own telnyx connections"
  ON telnyx_connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own telnyx connections"
  ON telnyx_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Make telnyx_connection_id nullable on calls (user connections don't need project FK)
ALTER TABLE calls ALTER COLUMN telnyx_connection_id DROP NOT NULL;
