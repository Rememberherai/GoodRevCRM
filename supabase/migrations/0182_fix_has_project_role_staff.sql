-- Fix has_project_role to recognize roles added in migration 0132.
-- Without this, staff/case_manager/contractor/board_viewer members fail ALL
-- RLS checks on non-community tables (opportunities, rfps, people, orgs, etc.)
-- because the CASE returns NULL, and NULL >= required_hierarchy is always false.
CREATE OR REPLACE FUNCTION public.has_project_role(project_id UUID, required_role public.project_role)
RETURNS BOOLEAN AS $$
DECLARE
    user_role public.project_role;
    role_hierarchy INTEGER;
    required_hierarchy INTEGER;
BEGIN
    SELECT role INTO user_role
    FROM public.project_memberships
    WHERE project_memberships.project_id = has_project_role.project_id
    AND user_id = auth.uid();

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Role hierarchy: higher number = more permissions
    -- staff and case_manager are equivalent to member for CRM entity access
    -- contractor and board_viewer are equivalent to viewer (read-only)
    role_hierarchy := CASE user_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'staff' THEN 2
        WHEN 'case_manager' THEN 2
        WHEN 'member' THEN 2
        WHEN 'contractor' THEN 1
        WHEN 'board_viewer' THEN 1
        WHEN 'viewer' THEN 1
        ELSE 0
    END;

    required_hierarchy := CASE required_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'staff' THEN 2
        WHEN 'case_manager' THEN 2
        WHEN 'member' THEN 2
        WHEN 'contractor' THEN 1
        WHEN 'board_viewer' THEN 1
        WHEN 'viewer' THEN 1
        ELSE 0
    END;

    RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
