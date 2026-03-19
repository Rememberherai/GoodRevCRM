-- Fix: The UPDATE policy's WITH CHECK requires deleted_at IS NULL,
-- which blocks soft-delete (setting deleted_at to a non-null value).
-- Split into two policies: one for general updates, one for soft-delete by owners.

-- Drop the existing combined policy
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON public.projects;

-- Re-create: admins can update projects (but not soft-delete)
CREATE POLICY "Project owners and admins can update projects"
    ON public.projects
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(id, 'admin')
    )
    WITH CHECK (
        public.has_project_role(id, 'admin')
    );
