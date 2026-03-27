-- Migration: Grant writer workflow enhancements
-- Adds: grant_id on tasks, grant_budget_line_items table, funder_giving_history table,
--       internal_review_status on grants, 'grant' entity_type on entity_comments

-- ============================================================
-- A. Grant tasks — add grant_id foreign key to tasks
-- ============================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_grant_id
  ON public.tasks(grant_id)
  WHERE grant_id IS NOT NULL;

-- ============================================================
-- B. Grant budget line items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grant_budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grant_budget_line_items_grant_id
  ON public.grant_budget_line_items(grant_id);

ALTER TABLE public.grant_budget_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grant_budget_line_items_select" ON public.grant_budget_line_items;
CREATE POLICY "grant_budget_line_items_select" ON public.grant_budget_line_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = grant_budget_line_items.grant_id
      AND public.is_project_member(g.project_id)
  ));

DROP POLICY IF EXISTS "grant_budget_line_items_insert" ON public.grant_budget_line_items;
CREATE POLICY "grant_budget_line_items_insert" ON public.grant_budget_line_items
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = grant_budget_line_items.grant_id
      AND public.has_project_role(g.project_id, 'member')
  ));

DROP POLICY IF EXISTS "grant_budget_line_items_update" ON public.grant_budget_line_items;
CREATE POLICY "grant_budget_line_items_update" ON public.grant_budget_line_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = grant_budget_line_items.grant_id
      AND public.has_project_role(g.project_id, 'member')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = grant_budget_line_items.grant_id
      AND public.has_project_role(g.project_id, 'member')
  ));

DROP POLICY IF EXISTS "grant_budget_line_items_delete" ON public.grant_budget_line_items;
CREATE POLICY "grant_budget_line_items_delete" ON public.grant_budget_line_items
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = grant_budget_line_items.grant_id
      AND public.has_project_role(g.project_id, 'member')
  ));

DROP TRIGGER IF EXISTS handle_updated_at ON public.grant_budget_line_items;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.grant_budget_line_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- C. Funder giving history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.funder_giving_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_name TEXT NOT NULL DEFAULT '',
  year INTEGER,
  amount NUMERIC(14,2),
  program_area TEXT,
  recipient TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funder_giving_history_org_id
  ON public.funder_giving_history(organization_id);

ALTER TABLE public.funder_giving_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funder_giving_history_select" ON public.funder_giving_history;
CREATE POLICY "funder_giving_history_select" ON public.funder_giving_history
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = funder_giving_history.organization_id
      AND public.is_project_member(o.project_id)
  ));

DROP POLICY IF EXISTS "funder_giving_history_insert" ON public.funder_giving_history;
CREATE POLICY "funder_giving_history_insert" ON public.funder_giving_history
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = funder_giving_history.organization_id
      AND public.has_project_role(o.project_id, 'member')
  ));

DROP POLICY IF EXISTS "funder_giving_history_update" ON public.funder_giving_history;
CREATE POLICY "funder_giving_history_update" ON public.funder_giving_history
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = funder_giving_history.organization_id
      AND public.has_project_role(o.project_id, 'member')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = funder_giving_history.organization_id
      AND public.has_project_role(o.project_id, 'member')
  ));

DROP POLICY IF EXISTS "funder_giving_history_delete" ON public.funder_giving_history;
CREATE POLICY "funder_giving_history_delete" ON public.funder_giving_history
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = funder_giving_history.organization_id
      AND public.has_project_role(o.project_id, 'member')
  ));

DROP TRIGGER IF EXISTS handle_updated_at ON public.funder_giving_history;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.funder_giving_history
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- D. Internal review status on grants
-- ============================================================
ALTER TABLE public.grants
  ADD COLUMN IF NOT EXISTS internal_review_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.grants
  DROP CONSTRAINT IF EXISTS grants_internal_review_status_check;

ALTER TABLE public.grants
  ADD CONSTRAINT grants_internal_review_status_check
  CHECK (internal_review_status IN ('draft', 'in_review', 'approved', 'needs_revision'));

-- ============================================================
-- E. Extend entity_comments to support 'grant' entity_type
-- ============================================================
ALTER TABLE public.entity_comments
  DROP CONSTRAINT IF EXISTS entity_comments_entity_type_check;

ALTER TABLE public.entity_comments
  ADD CONSTRAINT entity_comments_entity_type_check
  CHECK (entity_type IN ('person', 'organization', 'opportunity', 'grant'));
