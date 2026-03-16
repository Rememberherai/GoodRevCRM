-- Fix: Add column allowlist to perform_merge to prevent overwriting protected columns
-- via user-supplied field_selections (e.g. id, project_id, deleted_at, created_by)

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
  v_person_allowed_fields TEXT[] := ARRAY[
    'first_name', 'last_name', 'email', 'phone', 'mobile_phone',
    'job_title', 'department', 'linkedin_url', 'twitter_url',
    'city', 'state', 'country', 'address', 'postal_code',
    'company_name', 'website', 'notes', 'tags', 'source',
    'custom_fields', 'avatar_url', 'timezone', 'preferred_language'
  ];
  v_org_allowed_fields TEXT[] := ARRAY[
    'name', 'domain', 'website', 'linkedin_url', 'twitter_url',
    'phone', 'email', 'industry', 'employee_count', 'annual_revenue',
    'description', 'city', 'state', 'country', 'address', 'postal_code',
    'logo_url', 'tags', 'source', 'custom_fields', 'notes'
  ];
BEGIN
  -- Validate field_selections keys against allowlist
  IF p_field_selections IS NOT NULL AND p_field_selections != '{}'::JSONB THEN
    IF p_entity_type = 'person' THEN
      IF EXISTS (
        SELECT key FROM jsonb_each_text(p_field_selections)
        WHERE key != ALL(v_person_allowed_fields)
      ) THEN
        RAISE EXCEPTION 'field_selections contains disallowed column(s)';
      END IF;
    ELSIF p_entity_type = 'organization' THEN
      IF EXISTS (
        SELECT key FROM jsonb_each_text(p_field_selections)
        WHERE key != ALL(v_org_allowed_fields)
      ) THEN
        RAISE EXCEPTION 'field_selections contains disallowed column(s)';
      END IF;
    END IF;
  END IF;

  IF p_entity_type = 'person' THEN
    SELECT jsonb_agg(to_jsonb(p.*)) INTO v_snapshot
    FROM people p
    WHERE p.id = ANY(p_merged_ids) AND p.project_id = p_project_id;

    SELECT to_jsonb(p.*) INTO v_survivor_record
    FROM people p WHERE p.id = p_survivor_id;

    -- Apply field selections to survivor
    IF p_field_selections IS NOT NULL AND p_field_selections != '{}'::JSONB THEN
      FOR v_field_key, v_source_id IN
        SELECT key, value::TEXT::UUID FROM jsonb_each_text(p_field_selections)
      LOOP
        IF v_source_id != p_survivor_id THEN
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

      -- opportunities (contact_person_id)
      UPDATE opportunities SET contact_person_id = p_survivor_id WHERE contact_person_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{opportunities}',
        to_jsonb(COALESCE((v_related_moved->>'opportunities')::INT, 0) + v_count));

      -- sequence_enrollments
      UPDATE sequence_enrollments SET person_id = p_survivor_id WHERE person_id = v_merged_id;
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

      -- opportunities (organization_id)
      UPDATE opportunities SET organization_id = p_survivor_id WHERE organization_id = v_merged_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_related_moved := jsonb_set(v_related_moved, '{opportunities}',
        to_jsonb(COALESCE((v_related_moved->>'opportunities')::INT, 0) + v_count));

      -- Soft-delete the merged record
      UPDATE organizations SET deleted_at = now() WHERE id = v_merged_id AND project_id = p_project_id;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Unsupported entity type: %', p_entity_type;
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
