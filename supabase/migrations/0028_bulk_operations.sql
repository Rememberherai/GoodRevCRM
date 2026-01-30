-- Migration: 0028_bulk_operations.sql
-- Description: Bulk operations for entities (bulk update, delete, assign, tag)

-- Bulk update people
CREATE OR REPLACE FUNCTION bulk_update_people(
  p_project_id UUID,
  p_person_ids UUID[],
  p_updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE people
    SET
      status = COALESCE(p_updates->>'status', status),
      owner_id = COALESCE((p_updates->>'owner_id')::UUID, owner_id),
      updated_at = NOW()
    WHERE id = ANY(p_person_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

-- Bulk delete people (soft delete)
CREATE OR REPLACE FUNCTION bulk_delete_people(
  p_project_id UUID,
  p_person_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    UPDATE people
    SET deleted_at = NOW()
    WHERE id = ANY(p_person_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

-- Bulk restore people
CREATE OR REPLACE FUNCTION bulk_restore_people(
  p_project_id UUID,
  p_person_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH restored AS (
    UPDATE people
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = ANY(p_person_ids)
      AND project_id = p_project_id
      AND deleted_at IS NOT NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM restored;

  RETURN v_count;
END;
$$;

-- Bulk update organizations
CREATE OR REPLACE FUNCTION bulk_update_organizations(
  p_project_id UUID,
  p_organization_ids UUID[],
  p_updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE organizations
    SET
      status = COALESCE(p_updates->>'status', status),
      owner_id = COALESCE((p_updates->>'owner_id')::UUID, owner_id),
      updated_at = NOW()
    WHERE id = ANY(p_organization_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

-- Bulk delete organizations (soft delete)
CREATE OR REPLACE FUNCTION bulk_delete_organizations(
  p_project_id UUID,
  p_organization_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    UPDATE organizations
    SET deleted_at = NOW()
    WHERE id = ANY(p_organization_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

-- Bulk update opportunities
CREATE OR REPLACE FUNCTION bulk_update_opportunities(
  p_project_id UUID,
  p_opportunity_ids UUID[],
  p_updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE opportunities
    SET
      stage = COALESCE(p_updates->>'stage', stage),
      status = COALESCE(p_updates->>'status', status),
      owner_id = COALESCE((p_updates->>'owner_id')::UUID, owner_id),
      updated_at = NOW()
    WHERE id = ANY(p_opportunity_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

-- Bulk delete opportunities (soft delete)
CREATE OR REPLACE FUNCTION bulk_delete_opportunities(
  p_project_id UUID,
  p_opportunity_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    UPDATE opportunities
    SET deleted_at = NOW()
    WHERE id = ANY(p_opportunity_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

-- Bulk update tasks
CREATE OR REPLACE FUNCTION bulk_update_tasks(
  p_project_id UUID,
  p_task_ids UUID[],
  p_updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE tasks
    SET
      status = COALESCE(p_updates->>'status', status),
      priority = COALESCE(p_updates->>'priority', priority),
      assignee_id = COALESCE((p_updates->>'assignee_id')::UUID, assignee_id),
      due_date = COALESCE((p_updates->>'due_date')::TIMESTAMPTZ, due_date),
      updated_at = NOW()
    WHERE id = ANY(p_task_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;

-- Bulk delete tasks (soft delete)
CREATE OR REPLACE FUNCTION bulk_delete_tasks(
  p_project_id UUID,
  p_task_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    UPDATE tasks
    SET deleted_at = NOW()
    WHERE id = ANY(p_task_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

-- Bulk complete tasks
CREATE OR REPLACE FUNCTION bulk_complete_tasks(
  p_project_id UUID,
  p_task_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH completed AS (
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = ANY(p_task_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
      AND status != 'completed'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM completed;

  RETURN v_count;
END;
$$;

-- Entity tags table for bulk tagging
CREATE TABLE IF NOT EXISTS entity_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Entity tag assignments
CREATE TABLE IF NOT EXISTS entity_tag_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID NOT NULL REFERENCES entity_tags(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tag_id, entity_type, entity_id)
);

-- RLS for entity_tags
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tags in their projects"
  ON entity_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = entity_tags.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage tags in their projects"
  ON entity_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = entity_tags.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

-- RLS for entity_tag_assignments
ALTER TABLE entity_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tag assignments in their projects"
  ON entity_tag_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entity_tags
      JOIN project_memberships ON project_memberships.project_id = entity_tags.project_id
      WHERE entity_tags.id = entity_tag_assignments.tag_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage tag assignments in their projects"
  ON entity_tag_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM entity_tags
      JOIN project_memberships ON project_memberships.project_id = entity_tags.project_id
      WHERE entity_tags.id = entity_tag_assignments.tag_id
        AND project_memberships.user_id = auth.uid()
    )
  );

-- Bulk assign tags
CREATE OR REPLACE FUNCTION bulk_assign_tags(
  p_project_id UUID,
  p_tag_ids UUID[],
  p_entity_type VARCHAR(50),
  p_entity_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tag_id UUID;
  v_entity_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Verify tags belong to project
  IF NOT EXISTS (
    SELECT 1 FROM entity_tags
    WHERE id = ANY(p_tag_ids) AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Invalid tag IDs for project';
  END IF;

  FOREACH v_tag_id IN ARRAY p_tag_ids LOOP
    FOREACH v_entity_id IN ARRAY p_entity_ids LOOP
      INSERT INTO entity_tag_assignments (tag_id, entity_type, entity_id)
      VALUES (v_tag_id, p_entity_type, v_entity_id)
      ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING;

      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Bulk remove tags
CREATE OR REPLACE FUNCTION bulk_remove_tags(
  p_project_id UUID,
  p_tag_ids UUID[],
  p_entity_type VARCHAR(50),
  p_entity_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify tags belong to project
  IF NOT EXISTS (
    SELECT 1 FROM entity_tags
    WHERE id = ANY(p_tag_ids) AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Invalid tag IDs for project';
  END IF;

  WITH deleted AS (
    DELETE FROM entity_tag_assignments
    WHERE tag_id = ANY(p_tag_ids)
      AND entity_type = p_entity_type
      AND entity_id = ANY(p_entity_ids)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entity_tags_project ON entity_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_entity_tag_assignments_tag ON entity_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_entity_tag_assignments_entity ON entity_tag_assignments(entity_type, entity_id);
