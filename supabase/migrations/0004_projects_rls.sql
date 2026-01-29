-- Migration 004: Projects and memberships RLS policies
-- Implements row-level security for multi-tenant access control

-- Helper function to check if user is a member of a project
CREATE OR REPLACE FUNCTION public.is_project_member(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.project_memberships
        WHERE project_memberships.project_id = is_project_member.project_id
        AND project_memberships.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has specific role or higher in a project
CREATE OR REPLACE FUNCTION public.has_project_role(project_id UUID, required_role public.project_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role public.project_role;
    role_hierarchy INTEGER;
    required_hierarchy INTEGER;
BEGIN
    -- Get user's role in the project
    SELECT role INTO user_role
    FROM public.project_memberships
    WHERE project_memberships.project_id = has_project_role.project_id
    AND user_id = auth.uid();

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Define role hierarchy (higher number = more permissions)
    role_hierarchy := CASE user_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
    END;

    required_hierarchy := CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
    END;

    RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Projects RLS Policies

-- Users can view projects they are members of
CREATE POLICY "Users can view projects they belong to"
    ON public.projects
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.is_project_member(id)
    );

-- Project owners can update their projects
CREATE POLICY "Project owners and admins can update projects"
    ON public.projects
    FOR UPDATE
    USING (
        deleted_at IS NULL
        AND public.has_project_role(id, 'admin')
    )
    WITH CHECK (
        deleted_at IS NULL
        AND public.has_project_role(id, 'admin')
    );

-- Users can create new projects (they become the owner)
CREATE POLICY "Authenticated users can create projects"
    ON public.projects
    FOR INSERT
    WITH CHECK (
        auth.uid() = owner_id
    );

-- Only owners can delete (soft delete) projects
CREATE POLICY "Project owners can delete projects"
    ON public.projects
    FOR DELETE
    USING (
        public.has_project_role(id, 'owner')
    );

-- Project Memberships RLS Policies

-- Members can view other memberships in their projects
CREATE POLICY "Members can view project memberships"
    ON public.project_memberships
    FOR SELECT
    USING (
        public.is_project_member(project_id)
    );

-- Admins can add members
CREATE POLICY "Admins can add project members"
    ON public.project_memberships
    FOR INSERT
    WITH CHECK (
        public.has_project_role(project_id, 'admin')
        OR (
            -- Allow users to join as owner when creating a new project
            user_id = auth.uid()
            AND role = 'owner'
            AND EXISTS (
                SELECT 1 FROM public.projects
                WHERE projects.id = project_id
                AND projects.owner_id = auth.uid()
            )
        )
    );

-- Admins can update member roles (except owners can only be changed by owners)
CREATE POLICY "Admins can update project memberships"
    ON public.project_memberships
    FOR UPDATE
    USING (
        public.has_project_role(project_id, 'admin')
    )
    WITH CHECK (
        public.has_project_role(project_id, 'admin')
        -- Prevent demoting owners unless you're also an owner
        AND (role != 'owner' OR public.has_project_role(project_id, 'owner'))
    );

-- Admins can remove members (except owners)
CREATE POLICY "Admins can remove project members"
    ON public.project_memberships
    FOR DELETE
    USING (
        public.has_project_role(project_id, 'admin')
        AND role != 'owner'
    );

-- Users can remove themselves from a project (leave)
CREATE POLICY "Users can leave projects"
    ON public.project_memberships
    FOR DELETE
    USING (
        user_id = auth.uid()
        AND role != 'owner'  -- Owners cannot abandon their projects
    );

-- Function to automatically create membership when project is created
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.project_memberships (project_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create owner membership on project creation
CREATE TRIGGER on_project_created
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_project();
