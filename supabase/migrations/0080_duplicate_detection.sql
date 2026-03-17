-- Duplicate detection and merge system
-- Tables: duplicate_candidates, merge_history
-- RPC: perform_merge (atomic merge operation)

-- duplicate_candidates: stores potential duplicate pairs for review
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization')),
  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  match_score DECIMAL(5,4) NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
  match_reasons JSONB NOT NULL DEFAULT '[]',
  detection_source TEXT NOT NULL CHECK (detection_source IN ('manual_creation', 'csv_import', 'epa_import', 'contact_discovery', 'bulk_scan')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'allowed', 'merged')),
  status_changed_at TIMESTAMPTZ,
  status_changed_by UUID REFERENCES auth.users(id),
  merged_at TIMESTAMPTZ,
  merged_by UUID REFERENCES auth.users(id),
  survivor_id UUID,
  merge_audit JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, entity_type, source_id, target_id)
);

-- merge_history: audit log of all merges
CREATE TABLE IF NOT EXISTS merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization')),
  survivor_id UUID NOT NULL,
  merged_ids UUID[] NOT NULL,
  field_selections JSONB,
  related_records_moved JSONB,
  merged_by UUID REFERENCES auth.users(id),
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_records_snapshot JSONB
);

-- dedup_settings: per-project configurable thresholds
CREATE TABLE IF NOT EXISTS dedup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  min_match_threshold DECIMAL(5,4) NOT NULL DEFAULT 0.6000,
  auto_merge_threshold DECIMAL(5,4) NOT NULL DEFAULT 0.9500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_project_status ON duplicate_candidates(project_id, status);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_project_entity_status ON duplicate_candidates(project_id, entity_type, status);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_source_id ON duplicate_candidates(source_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_target_id ON duplicate_candidates(target_id);
CREATE INDEX IF NOT EXISTS idx_merge_history_project_entity ON merge_history(project_id, entity_type);

-- updated_at triggers
CREATE TRIGGER set_updated_at_duplicate_candidates
  BEFORE UPDATE ON duplicate_candidates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at_dedup_settings
  BEFORE UPDATE ON dedup_settings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE merge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dedup_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies: project members can read/write
CREATE POLICY "Project members can view duplicate candidates"
  ON duplicate_candidates FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can insert duplicate candidates"
  ON duplicate_candidates FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can update duplicate candidates"
  ON duplicate_candidates FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can delete duplicate candidates"
  ON duplicate_candidates FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can view merge history"
  ON merge_history FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can insert merge history"
  ON merge_history FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can view dedup settings"
  ON dedup_settings FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Project members can manage dedup settings"
  ON dedup_settings FOR ALL
  USING (project_id IN (
    SELECT project_id FROM project_memberships WHERE user_id = auth.uid()
  ));

-- Atomic merge RPC function
CREATE OR REPLACE FUNCTION perform_merge(
  p_project_id UUID,
  p_entity_type TEXT,
  p_survivor_id UUID,
  p_merged_ids UUID[],
  p_field_selections JSONB,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_merged_id UUID;
  v_related_moved JSONB := '{}'::JSONB;
  v_snapshot JSONB := '[]'::JSONB;
  v_survivor_record JSONB;
  v_merge_history_id UUID;
  v_count INT;
  v_field_key TEXT;
  v_field_value TEXT;
  v_source_id UUID;
BEGIN
  -- Snapshot all records being merged
  IF p_entity_type = 'person' THEN
    SELECT jsonb_agg(to_jsonb(p.*)) INTO v_snapshot
    FROM people p
    WHERE p.id = ANY(p_merged_ids) AND p.project_id = p_project_id;

    -- Get survivor record
    SELECT to_jsonb(p.*) INTO v_survivor_record
    FROM people p WHERE p.id = p_survivor_id;

    -- Apply field selections to survivor
    IF p_field_selections IS NOT NULL AND p_field_selections != '{}'::JSONB THEN
      FOR v_field_key, v_source_id IN
        SELECT key, value::TEXT::UUID FROM jsonb_each_text(p_field_selections)
      LOOP
        IF v_source_id != p_survivor_id THEN
          -- Get the field value from the source record in snapshot
          EXECUTE format(
            'UPDATE people SET %I = (SELECT %I FROM people WHERE id = $1) WHERE id = $2',
            v_field_key, v_field_key
          ) USING v_source_id, p_survivor_id;
        END IF;
      END LOOP;
    END IF;

    -- Reassign related records for each merged ID
    FOREACH v_merged_id IN ARRAY p_merged_ids LOOP
      -- person_organizations
      UPDATE person_organizations SET person_id = p_survivor_id
      WHERE person_id = v_merged_id AND project_id = p_project_id
      AND NOT EXISTS (
        SELECT 1 FROM person_organizations
        WHERE person_id = p_survivor_id AND organization_id = person_organizations.organization_id
        AND project_id = p_project_id
      );
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{person_organizations}',
        to_jsonb(COALESCE((v_related_moved->>'person_organizations')::INT, 0) + v_count));

      -- Delete conflicting person_organizations
      DELETE FROM person_organizations WHERE person_id = v_merged_id AND project_id = p_project_id;

      -- activity_log
      UPDATE activity_log SET person_id = p_survivor_id WHERE person_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{activity_log}',
        to_jsonb(COALESCE((v_related_moved->>'activity_log')::INT, 0) + v_count));

      -- notes
      UPDATE notes SET person_id = p_survivor_id WHERE person_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{notes}',
        to_jsonb(COALESCE((v_related_moved->>'notes')::INT, 0) + v_count));

      -- tasks
      UPDATE tasks SET person_id = p_survivor_id WHERE person_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{tasks}',
        to_jsonb(COALESCE((v_related_moved->>'tasks')::INT, 0) + v_count));

      -- sent_emails
      UPDATE sent_emails SET person_id = p_survivor_id WHERE person_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{sent_emails}',
        to_jsonb(COALESCE((v_related_moved->>'sent_emails')::INT, 0) + v_count));

      -- entity_comments
      UPDATE entity_comments SET entity_id = p_survivor_id::TEXT
      WHERE entity_id = v_merged_id::TEXT AND entity_type = 'person';
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{entity_comments}',
        to_jsonb(COALESCE((v_related_moved->>'entity_comments')::INT, 0) + v_count));

      -- opportunities
      UPDATE opportunities SET primary_contact_id = p_survivor_id WHERE primary_contact_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{opportunities}',
        to_jsonb(COALESCE((v_related_moved->>'opportunities')::INT, 0) + v_count));

      -- sequence_enrollments (cancel duplicates first)
      UPDATE sequence_enrollments SET status = 'cancelled'
      WHERE person_id = v_merged_id AND status = 'active'
      AND sequence_id IN (SELECT sequence_id FROM sequence_enrollments WHERE person_id = p_survivor_id AND status = 'active');

      UPDATE sequence_enrollments SET person_id = p_survivor_id
      WHERE person_id = v_merged_id
      AND NOT EXISTS (
        SELECT 1 FROM sequence_enrollments se2
        WHERE se2.person_id = p_survivor_id AND se2.sequence_id = sequence_enrollments.sequence_id AND se2.status = 'active'
      );
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{sequence_enrollments}',
        to_jsonb(COALESCE((v_related_moved->>'sequence_enrollments')::INT, 0) + v_count));

      -- Soft-delete the merged record
      UPDATE people SET deleted_at = now() WHERE id = v_merged_id AND project_id = p_project_id;
    END LOOP;

  ELSIF p_entity_type = 'organization' THEN
    SELECT jsonb_agg(to_jsonb(o.*)) INTO v_snapshot
    FROM organizations o
    WHERE o.id = ANY(p_merged_ids) AND o.project_id = p_project_id;

    SELECT to_jsonb(o.*) INTO v_survivor_record
    FROM organizations o WHERE o.id = p_survivor_id;

    -- Apply field selections to survivor
    IF p_field_selections IS NOT NULL AND p_field_selections != '{}'::JSONB THEN
      FOR v_field_key, v_source_id IN
        SELECT key, value::TEXT::UUID FROM jsonb_each_text(p_field_selections)
      LOOP
        IF v_source_id != p_survivor_id THEN
          EXECUTE format(
            'UPDATE organizations SET %I = (SELECT %I FROM organizations WHERE id = $1) WHERE id = $2',
            v_field_key, v_field_key
          ) USING v_source_id, p_survivor_id;
        END IF;
      END LOOP;
    END IF;

    FOREACH v_merged_id IN ARRAY p_merged_ids LOOP
      -- person_organizations
      UPDATE person_organizations SET organization_id = p_survivor_id
      WHERE organization_id = v_merged_id AND project_id = p_project_id
      AND NOT EXISTS (
        SELECT 1 FROM person_organizations
        WHERE organization_id = p_survivor_id AND person_id = person_organizations.person_id
        AND project_id = p_project_id
      );
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{person_organizations}',
        to_jsonb(COALESCE((v_related_moved->>'person_organizations')::INT, 0) + v_count));

      DELETE FROM person_organizations WHERE organization_id = v_merged_id AND project_id = p_project_id;

      -- activity_log
      UPDATE activity_log SET organization_id = p_survivor_id WHERE organization_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{activity_log}',
        to_jsonb(COALESCE((v_related_moved->>'activity_log')::INT, 0) + v_count));

      -- notes
      UPDATE notes SET organization_id = p_survivor_id WHERE organization_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{notes}',
        to_jsonb(COALESCE((v_related_moved->>'notes')::INT, 0) + v_count));

      -- tasks
      UPDATE tasks SET organization_id = p_survivor_id WHERE organization_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{tasks}',
        to_jsonb(COALESCE((v_related_moved->>'tasks')::INT, 0) + v_count));

      -- entity_comments
      UPDATE entity_comments SET entity_id = p_survivor_id::TEXT
      WHERE entity_id = v_merged_id::TEXT AND entity_type = 'organization';
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{entity_comments}',
        to_jsonb(COALESCE((v_related_moved->>'entity_comments')::INT, 0) + v_count));

      -- opportunities
      UPDATE opportunities SET organization_id = p_survivor_id WHERE organization_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{opportunities}',
        to_jsonb(COALESCE((v_related_moved->>'opportunities')::INT, 0) + v_count));

      -- Soft-delete
      UPDATE organizations SET deleted_at = now() WHERE id = v_merged_id AND project_id = p_project_id;
    END LOOP;
  END IF;

  -- Update duplicate_candidates involving merged records
  UPDATE duplicate_candidates SET status = 'merged', merged_at = now(), merged_by = p_user_id,
    survivor_id = p_survivor_id, status_changed_at = now(), status_changed_by = p_user_id
  WHERE project_id = p_project_id
    AND (source_id = ANY(p_merged_ids) OR target_id = ANY(p_merged_ids))
    AND status = 'pending';

  -- Create merge_history record
  INSERT INTO merge_history (project_id, entity_type, survivor_id, merged_ids, field_selections,
    related_records_moved, merged_by, merged_records_snapshot)
  VALUES (p_project_id, p_entity_type, p_survivor_id, p_merged_ids, p_field_selections,
    v_related_moved, p_user_id, v_snapshot)
  RETURNING id INTO v_merge_history_id;

  RETURN jsonb_build_object(
    'merge_history_id', v_merge_history_id,
    'related_records_moved', v_related_moved,
    'merged_records_snapshot', v_snapshot
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
