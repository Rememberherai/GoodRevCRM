-- Global search function for Phase 15
CREATE OR REPLACE FUNCTION global_search(
  p_project_id UUID,
  p_query TEXT,
  p_entity_types TEXT[] DEFAULT ARRAY['organization', 'person', 'opportunity', 'rfp'],
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  name TEXT,
  subtitle TEXT,
  match_field TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  WITH search_results AS (
    -- Organizations
    SELECT
      'organization'::TEXT as entity_type,
      o.id as entity_id,
      o.name,
      o.domain as subtitle,
      CASE
        WHEN o.name ILIKE '%' || p_query || '%' THEN 'name'
        WHEN o.domain ILIKE '%' || p_query || '%' THEN 'domain'
        WHEN o.website ILIKE '%' || p_query || '%' THEN 'website'
        ELSE 'other'
      END as match_field,
      CASE
        WHEN o.name ILIKE p_query THEN 1.0
        WHEN o.name ILIKE p_query || '%' THEN 0.9
        WHEN o.name ILIKE '%' || p_query || '%' THEN 0.7
        WHEN o.domain ILIKE '%' || p_query || '%' THEN 0.6
        ELSE 0.5
      END::REAL as relevance
    FROM organizations o
    WHERE o.project_id = p_project_id
      AND o.deleted_at IS NULL
      AND 'organization' = ANY(p_entity_types)
      AND (
        o.name ILIKE '%' || p_query || '%'
        OR o.domain ILIKE '%' || p_query || '%'
        OR o.website ILIKE '%' || p_query || '%'
        OR o.industry ILIKE '%' || p_query || '%'
      )

    UNION ALL

    -- People
    SELECT
      'person'::TEXT,
      p.id,
      COALESCE(p.first_name || ' ' || p.last_name, p.email),
      p.job_title,
      CASE
        WHEN p.first_name ILIKE '%' || p_query || '%' THEN 'first_name'
        WHEN p.last_name ILIKE '%' || p_query || '%' THEN 'last_name'
        WHEN p.email ILIKE '%' || p_query || '%' THEN 'email'
        ELSE 'other'
      END,
      CASE
        WHEN CONCAT(p.first_name, ' ', p.last_name) ILIKE p_query THEN 1.0
        WHEN p.first_name ILIKE p_query || '%' THEN 0.9
        WHEN p.email ILIKE p_query || '%' THEN 0.8
        WHEN CONCAT(p.first_name, ' ', p.last_name) ILIKE '%' || p_query || '%' THEN 0.7
        ELSE 0.5
      END::REAL
    FROM people p
    WHERE p.project_id = p_project_id
      AND p.deleted_at IS NULL
      AND 'person' = ANY(p_entity_types)
      AND (
        p.first_name ILIKE '%' || p_query || '%'
        OR p.last_name ILIKE '%' || p_query || '%'
        OR p.email ILIKE '%' || p_query || '%'
        OR p.job_title ILIKE '%' || p_query || '%'
      )

    UNION ALL

    -- Opportunities
    SELECT
      'opportunity'::TEXT,
      op.id,
      op.name,
      op.stage::TEXT,
      CASE
        WHEN op.name ILIKE '%' || p_query || '%' THEN 'name'
        ELSE 'other'
      END,
      CASE
        WHEN op.name ILIKE p_query THEN 1.0
        WHEN op.name ILIKE p_query || '%' THEN 0.9
        WHEN op.name ILIKE '%' || p_query || '%' THEN 0.7
        ELSE 0.5
      END::REAL
    FROM opportunities op
    WHERE op.project_id = p_project_id
      AND op.deleted_at IS NULL
      AND 'opportunity' = ANY(p_entity_types)
      AND (
        op.name ILIKE '%' || p_query || '%'
        OR op.description ILIKE '%' || p_query || '%'
      )

    UNION ALL

    -- RFPs
    SELECT
      'rfp'::TEXT,
      r.id,
      r.title,
      r.rfp_number,
      CASE
        WHEN r.title ILIKE '%' || p_query || '%' THEN 'title'
        WHEN r.rfp_number ILIKE '%' || p_query || '%' THEN 'rfp_number'
        ELSE 'other'
      END,
      CASE
        WHEN r.title ILIKE p_query THEN 1.0
        WHEN r.title ILIKE p_query || '%' THEN 0.9
        WHEN r.rfp_number ILIKE p_query || '%' THEN 0.85
        WHEN r.title ILIKE '%' || p_query || '%' THEN 0.7
        ELSE 0.5
      END::REAL
    FROM rfps r
    WHERE r.project_id = p_project_id
      AND r.deleted_at IS NULL
      AND 'rfp' = ANY(p_entity_types)
      AND (
        r.title ILIKE '%' || p_query || '%'
        OR r.rfp_number ILIKE '%' || p_query || '%'
        OR r.description ILIKE '%' || p_query || '%'
      )
  )
  SELECT * FROM search_results
  ORDER BY relevance DESC, name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
