-- Report Engine Fixes:
-- 1. Soft-delete filtering on JOINed tables (not just primary object)
-- 2. Accurate total_rows counting (COUNT before LIMIT)
-- 3. Expanded FK resolution with reverse join support

-- ── 1. Build-join helper with forward + reverse FK resolution ────────────────

CREATE OR REPLACE FUNCTION _build_report_join(
  p_primary TEXT,
  p_related TEXT
) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE v_fk TEXT;
BEGIN
  -- Forward: primary table has FK pointing to related table
  v_fk := _resolve_report_fk(p_primary, p_related);
  IF v_fk IS NOT NULL THEN
    RETURN format('LEFT JOIN %I ON %I.%I = %I.id', p_related, p_primary, v_fk, p_related);
  END IF;

  -- Reverse: related table has FK pointing to primary table
  v_fk := _resolve_report_fk(p_related, p_primary);
  IF v_fk IS NOT NULL THEN
    RETURN format('LEFT JOIN %I ON %I.%I = %I.id', p_related, p_related, v_fk, p_primary);
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION _build_report_join(TEXT, TEXT) TO authenticated;

-- ── 2. Replace execute_custom_report with fixed version ─────────────────────

CREATE OR REPLACE FUNCTION execute_custom_report(
  p_config JSONB,
  p_project_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
SET search_path = public
AS $$
DECLARE
  v_primary_object TEXT;
  v_sql_base TEXT;
  v_sql TEXT;
  v_select_parts TEXT[];
  v_join_parts TEXT[];
  v_where_parts TEXT[];
  v_group_parts TEXT[];
  v_order_parts TEXT[];
  v_limit INT;
  v_col JSONB;
  v_filter JSONB;
  v_agg JSONB;
  v_order JSONB;
  v_gb TEXT;
  v_rows JSONB;
  v_total_rows INT;
  v_joined_tables TEXT[] := ARRAY[]::TEXT[];
  v_allowed_tables TEXT[] := ARRAY[
    'organizations', 'people', 'opportunities', 'rfps',
    'activity_log', 'tasks', 'sent_emails', 'calls',
    'meetings', 'sequence_enrollments'
  ];
  v_soft_delete_tables TEXT[] := ARRAY[
    'organizations', 'people', 'opportunities', 'rfps'
  ];
  v_fk_column TEXT;
  v_related_table TEXT;
  v_field_name TEXT;
  v_object_name TEXT;
  v_alias TEXT;
  v_agg_func TEXT;
  v_col_ref TEXT;
  v_operator TEXT;
  v_value TEXT;
  v_value2 TEXT;
  v_join_clause TEXT;
BEGIN
  -- ── Auth check ──────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM project_memberships
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this project';
  END IF;

  -- ── Extract primary object ──────────────────────────────────────────────
  v_primary_object := p_config->>'primary_object';

  IF v_primary_object IS NULL OR NOT (v_primary_object = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Invalid primary object: %', COALESCE(v_primary_object, 'null');
  END IF;

  -- ── Build SELECT columns ───────────────────────────────────────────────
  v_select_parts := ARRAY[]::TEXT[];

  -- Group-by columns first (non-aggregated)
  IF p_config->'group_by' IS NOT NULL AND jsonb_array_length(p_config->'group_by') > 0 THEN
    FOR v_gb IN SELECT jsonb_array_elements_text(p_config->'group_by')
    LOOP
      IF v_gb LIKE 'custom_fields.%' THEN
        v_field_name := substring(v_gb from 15);
        v_select_parts := array_append(v_select_parts,
          format('%I.custom_fields->>%L AS %I', v_primary_object, v_field_name, v_gb)
        );
      ELSE
        IF v_gb !~ '^[a-z_][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid group-by field name: %', v_gb;
        END IF;
        v_select_parts := array_append(v_select_parts,
          format('%I.%I', v_primary_object, v_gb)
        );
      END IF;
    END LOOP;
  END IF;

  -- Aggregation columns
  IF p_config->'aggregations' IS NOT NULL THEN
    FOR v_agg IN SELECT jsonb_array_elements(p_config->'aggregations')
    LOOP
      v_object_name := v_agg->>'object_name';
      v_field_name := v_agg->>'field_name';
      v_alias := v_agg->>'alias';
      v_agg_func := v_agg->>'function';

      IF NOT (v_object_name = ANY(v_allowed_tables)) THEN
        RAISE EXCEPTION 'Invalid object in aggregation: %', v_object_name;
      END IF;

      IF v_agg_func NOT IN ('sum', 'avg', 'count', 'min', 'max', 'count_distinct') THEN
        RAISE EXCEPTION 'Invalid aggregation function: %', v_agg_func;
      END IF;

      IF v_alias !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid aggregation alias: %', v_alias;
      END IF;

      IF v_field_name LIKE 'custom_fields.%' THEN
        v_col_ref := format('(%I.custom_fields->>%L)::numeric',
          v_object_name, substring(v_field_name from 15));
      ELSE
        IF v_field_name !~ '^[a-z_][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid field name: %', v_field_name;
        END IF;
        v_col_ref := format('%I.%I', v_object_name, v_field_name);
      END IF;

      CASE v_agg_func
        WHEN 'count_distinct' THEN
          v_select_parts := array_append(v_select_parts,
            format('COUNT(DISTINCT %s) AS %I', v_col_ref, v_alias));
        WHEN 'count' THEN
          v_select_parts := array_append(v_select_parts,
            format('COUNT(%s) AS %I', v_col_ref, v_alias));
        WHEN 'sum' THEN
          v_select_parts := array_append(v_select_parts,
            format('COALESCE(SUM(%s), 0) AS %I', v_col_ref, v_alias));
        WHEN 'avg' THEN
          v_select_parts := array_append(v_select_parts,
            format('COALESCE(AVG(%s), 0) AS %I', v_col_ref, v_alias));
        WHEN 'min' THEN
          v_select_parts := array_append(v_select_parts,
            format('MIN(%s) AS %I', v_col_ref, v_alias));
        WHEN 'max' THEN
          v_select_parts := array_append(v_select_parts,
            format('MAX(%s) AS %I', v_col_ref, v_alias));
      END CASE;

      IF v_object_name != v_primary_object AND NOT (v_object_name = ANY(v_joined_tables)) THEN
        v_joined_tables := array_append(v_joined_tables, v_object_name);
      END IF;
    END LOOP;
  END IF;

  -- If no group_by and no aggregations, select regular columns
  IF array_length(v_select_parts, 1) IS NULL OR array_length(v_select_parts, 1) = 0 THEN
    FOR v_col IN SELECT jsonb_array_elements(p_config->'columns')
    LOOP
      v_object_name := v_col->>'object_name';
      v_field_name := v_col->>'field_name';
      v_alias := v_col->>'alias';

      IF NOT (v_object_name = ANY(v_allowed_tables)) THEN
        RAISE EXCEPTION 'Invalid object in column: %', v_object_name;
      END IF;

      IF v_field_name LIKE 'custom_fields.%' THEN
        v_col_ref := format('%I.custom_fields->>%L',
          v_object_name, substring(v_field_name from 15));
      ELSE
        IF v_field_name !~ '^[a-z_][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid field name: %', v_field_name;
        END IF;
        v_col_ref := format('%I.%I', v_object_name, v_field_name);
      END IF;

      IF v_alias IS NOT NULL AND v_alias !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid column alias: %', v_alias;
      END IF;

      IF v_alias IS NOT NULL THEN
        v_select_parts := array_append(v_select_parts, format('%s AS %I', v_col_ref, v_alias));
      ELSE
        v_select_parts := array_append(v_select_parts, v_col_ref);
      END IF;

      IF v_object_name != v_primary_object AND NOT (v_object_name = ANY(v_joined_tables)) THEN
        v_joined_tables := array_append(v_joined_tables, v_object_name);
      END IF;
    END LOOP;
  END IF;

  -- ── Collect filter-referenced tables BEFORE building JOINs ────────────
  IF p_config->'filters' IS NOT NULL THEN
    FOR v_filter IN SELECT jsonb_array_elements(p_config->'filters')
    LOOP
      v_object_name := v_filter->>'object_name';
      IF v_object_name IS NOT NULL
         AND v_object_name != v_primary_object
         AND (v_object_name = ANY(v_allowed_tables))
         AND NOT (v_object_name = ANY(v_joined_tables))
      THEN
        v_joined_tables := array_append(v_joined_tables, v_object_name);
      END IF;
    END LOOP;
  END IF;

  -- ── Build JOINs using _build_report_join (supports forward + reverse) ─
  v_join_parts := ARRAY[]::TEXT[];

  FOR i IN 1..COALESCE(array_length(v_joined_tables, 1), 0)
  LOOP
    v_related_table := v_joined_tables[i];

    v_join_clause := _build_report_join(v_primary_object, v_related_table);

    IF v_join_clause IS NULL THEN
      RAISE EXCEPTION 'No known relationship from "%" to "%". Cannot join these tables.', v_primary_object, v_related_table;
    END IF;

    v_join_parts := array_append(v_join_parts, v_join_clause);
  END LOOP;

  -- ── Build WHERE clause ─────────────────────────────────────────────────
  v_where_parts := ARRAY[
    format('%I.project_id = %L', v_primary_object, p_project_id)
  ];

  -- Soft-delete on primary object
  IF v_primary_object = ANY(v_soft_delete_tables) THEN
    v_where_parts := array_append(v_where_parts,
      format('%I.deleted_at IS NULL', v_primary_object));
  END IF;

  -- FIX: Soft-delete on JOINed tables too
  FOR i IN 1..COALESCE(array_length(v_joined_tables, 1), 0)
  LOOP
    IF v_joined_tables[i] = ANY(v_soft_delete_tables) THEN
      v_where_parts := array_append(v_where_parts,
        format('%I.deleted_at IS NULL', v_joined_tables[i]));
    END IF;
  END LOOP;

  -- User-defined filters
  IF p_config->'filters' IS NOT NULL THEN
    FOR v_filter IN SELECT jsonb_array_elements(p_config->'filters')
    LOOP
      v_object_name := v_filter->>'object_name';
      v_field_name := v_filter->>'field_name';
      v_operator := v_filter->>'operator';
      v_value := v_filter->>'value';
      v_value2 := v_filter->>'value2';

      IF NOT (v_object_name = ANY(v_allowed_tables)) THEN
        RAISE EXCEPTION 'Invalid object in filter: %', v_object_name;
      END IF;

      IF v_field_name LIKE 'custom_fields.%' THEN
        v_col_ref := format('%I.custom_fields->>%L',
          v_object_name, substring(v_field_name from 15));
      ELSE
        IF v_field_name !~ '^[a-z_][a-z0-9_]*$' THEN
          RAISE EXCEPTION 'Invalid filter field: %', v_field_name;
        END IF;
        v_col_ref := format('%I.%I', v_object_name, v_field_name);
      END IF;

      CASE v_operator
        WHEN 'eq' THEN
          v_where_parts := array_append(v_where_parts, format('%s = %L', v_col_ref, v_value));
        WHEN 'neq' THEN
          v_where_parts := array_append(v_where_parts, format('%s != %L', v_col_ref, v_value));
        WHEN 'gt' THEN
          v_where_parts := array_append(v_where_parts, format('%s > %L', v_col_ref, v_value));
        WHEN 'gte' THEN
          v_where_parts := array_append(v_where_parts, format('%s >= %L', v_col_ref, v_value));
        WHEN 'lt' THEN
          v_where_parts := array_append(v_where_parts, format('%s < %L', v_col_ref, v_value));
        WHEN 'lte' THEN
          v_where_parts := array_append(v_where_parts, format('%s <= %L', v_col_ref, v_value));
        WHEN 'like' THEN
          v_where_parts := array_append(v_where_parts, format('%s LIKE %L', v_col_ref, '%' || v_value || '%'));
        WHEN 'ilike' THEN
          v_where_parts := array_append(v_where_parts, format('%s ILIKE %L', v_col_ref, '%' || v_value || '%'));
        WHEN 'in' THEN
          v_where_parts := array_append(v_where_parts,
            format('%s = ANY(ARRAY(SELECT jsonb_array_elements_text(%L::jsonb)))', v_col_ref, v_value));
        WHEN 'is_null' THEN
          v_where_parts := array_append(v_where_parts, format('%s IS NULL', v_col_ref));
        WHEN 'is_not_null' THEN
          v_where_parts := array_append(v_where_parts, format('%s IS NOT NULL', v_col_ref));
        WHEN 'between' THEN
          v_where_parts := array_append(v_where_parts,
            format('%s BETWEEN %L AND %L', v_col_ref, v_value, v_value2));
        ELSE
          RAISE EXCEPTION 'Invalid filter operator: %', v_operator;
      END CASE;
    END LOOP;
  END IF;

  -- ── Build GROUP BY ─────────────────────────────────────────────────────
  v_group_parts := ARRAY[]::TEXT[];
  IF p_config->'group_by' IS NOT NULL AND jsonb_array_length(p_config->'group_by') > 0 THEN
    FOR v_gb IN SELECT jsonb_array_elements_text(p_config->'group_by')
    LOOP
      IF v_gb LIKE 'custom_fields.%' THEN
        v_group_parts := array_append(v_group_parts,
          format('%I.custom_fields->>%L', v_primary_object, substring(v_gb from 15)));
      ELSE
        v_group_parts := array_append(v_group_parts,
          format('%I.%I', v_primary_object, v_gb));
      END IF;
    END LOOP;
  END IF;

  -- ── Build ORDER BY ─────────────────────────────────────────────────────
  v_order_parts := ARRAY[]::TEXT[];
  IF p_config->'order_by' IS NOT NULL THEN
    FOR v_order IN SELECT jsonb_array_elements(p_config->'order_by')
    LOOP
      v_field_name := v_order->>'field';
      IF v_field_name !~ '^[a-z_][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid order-by field: %', v_field_name;
      END IF;
      v_order_parts := array_append(v_order_parts,
        format('%I %s', v_field_name,
          CASE WHEN (v_order->>'direction') = 'asc' THEN 'ASC' ELSE 'DESC' END));
    END LOOP;
  END IF;

  -- ── Build limit ────────────────────────────────────────────────────────
  v_limit := LEAST(COALESCE((p_config->>'limit')::int, 500), 10000);

  -- ── Assemble base SQL (without LIMIT) ──────────────────────────────────
  v_sql_base := format('SELECT %s FROM %I', array_to_string(v_select_parts, ', '), v_primary_object);

  IF array_length(v_join_parts, 1) > 0 THEN
    v_sql_base := v_sql_base || ' ' || array_to_string(v_join_parts, ' ');
  END IF;

  v_sql_base := v_sql_base || ' WHERE ' || array_to_string(v_where_parts, ' AND ');

  IF array_length(v_group_parts, 1) > 0 THEN
    v_sql_base := v_sql_base || ' GROUP BY ' || array_to_string(v_group_parts, ', ');
  END IF;

  IF array_length(v_order_parts, 1) > 0 THEN
    v_sql_base := v_sql_base || ' ORDER BY ' || array_to_string(v_order_parts, ', ');
  ELSE
    IF array_length(v_group_parts, 1) > 0 THEN
      v_sql_base := v_sql_base || ' ORDER BY 1';
    END IF;
  END IF;

  -- ── FIX: Count total rows BEFORE applying LIMIT ────────────────────────
  EXECUTE format('SELECT COUNT(*) FROM (%s) _cnt', v_sql_base) INTO v_total_rows;

  -- ── Execute with LIMIT ─────────────────────────────────────────────────
  v_sql := v_sql_base || format(' LIMIT %s', v_limit);

  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', v_sql) INTO v_rows;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total_rows', v_total_rows
  );
END;
$$;

COMMENT ON FUNCTION execute_custom_report IS
  'Executes a dynamic custom report query. Validates caller is a project member, '
  'allowlists all table/column names, and caps results at 10,000 rows with 30s timeout. '
  'Fixed in 0142: soft-delete on JOINed tables, accurate total_rows via pre-LIMIT COUNT, '
  'reverse join support via _build_report_join.';
