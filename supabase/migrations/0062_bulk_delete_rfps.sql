-- Migration: 0062_bulk_delete_rfps.sql
-- Description: Bulk delete function for RFPs

-- Bulk delete RFPs (soft delete)
CREATE OR REPLACE FUNCTION bulk_delete_rfps(
  p_project_id UUID,
  p_rfp_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH deleted AS (
    UPDATE rfps
    SET deleted_at = NOW()
    WHERE id = ANY(p_rfp_ids)
      AND project_id = p_project_id
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN v_count;
END;
$$;
