-- Move Gmail connections from project-scoped to user-scoped
-- Gmail is now a user-level setting, not per-project

-- 1. Deduplicate: keep the most recent connection per (user_id, email)
DELETE FROM gmail_connections a
USING gmail_connections b
WHERE a.user_id = b.user_id
  AND a.email = b.email
  AND a.created_at < b.created_at;

-- 2. Drop old unique constraint (user_id, project_id, email)
ALTER TABLE gmail_connections
  DROP CONSTRAINT IF EXISTS gmail_connections_user_id_project_id_email_key;

-- 3. Make project_id nullable
ALTER TABLE gmail_connections
  ALTER COLUMN project_id DROP NOT NULL;

-- 4. Set existing project_id values to NULL (de-scope from projects)
UPDATE gmail_connections SET project_id = NULL;

-- 5. Add new unique constraint: one connection per user per email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gmail_connections_user_id_email_key'
  ) THEN
    ALTER TABLE gmail_connections
      ADD CONSTRAINT gmail_connections_user_id_email_key UNIQUE(user_id, email);
  END IF;
END $$;

-- 6. Make sent_emails.project_id nullable
ALTER TABLE sent_emails
  ALTER COLUMN project_id DROP NOT NULL;

-- 7. Update sent_emails RLS policies to handle NULL project_id
DROP POLICY IF EXISTS "Users can view sent emails in their projects" ON sent_emails;
CREATE POLICY "Users can view sent emails"
  ON sent_emails FOR SELECT
  USING (
    created_by = auth.uid()
    OR project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert sent emails in their projects" ON sent_emails;
CREATE POLICY "Users can insert sent emails"
  ON sent_emails FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    OR project_id IN (
      SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
    )
  );
