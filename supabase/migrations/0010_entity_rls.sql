-- Migration 010: Additional RLS policies for entity tables
-- Ensures viewers can read but not modify data

-- Allow viewers to see organizations (read-only)
CREATE POLICY "Viewers can view organizations"
    ON public.organizations
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'viewer')
    );

-- Allow viewers to see people (read-only)
CREATE POLICY "Viewers can view people"
    ON public.people
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'viewer')
    );

-- Allow viewers to see person-org links (read-only)
CREATE POLICY "Viewers can view person-org links"
    ON public.person_organizations
    FOR SELECT
    USING (
        public.has_project_role(project_id, 'viewer')
    );

-- Allow viewers to see opportunities (read-only)
CREATE POLICY "Viewers can view opportunities"
    ON public.opportunities
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'viewer')
    );

-- Allow viewers to see RFPs (read-only)
CREATE POLICY "Viewers can view rfps"
    ON public.rfps
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.has_project_role(project_id, 'viewer')
    );
