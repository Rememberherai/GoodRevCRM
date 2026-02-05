-- ============================================================================
-- Add DELETE policy for calls table
-- Allows project admins to delete call records
-- ============================================================================

-- Admins can delete calls in their projects
CREATE POLICY "Admins can delete calls"
  ON calls
  FOR DELETE
  USING (public.has_project_role(project_id, 'admin'));
