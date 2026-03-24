-- Migration 0145: Grant report schedules
-- Replaces the single report_due_at field with a proper multi-report schedule

CREATE TABLE IF NOT EXISTS public.grant_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'progress', 'financial', 'final', 'interim', 'annual', 'closeout', 'other'
  )),
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'in_progress', 'submitted', 'accepted', 'revision_requested'
  )),
  document_id UUID REFERENCES public.grant_documents(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.grant_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_grant_report_schedules_updated_at
  BEFORE UPDATE ON public.grant_report_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_grant_report_schedules_grant_due
  ON public.grant_report_schedules(grant_id, due_date);

CREATE INDEX IF NOT EXISTS idx_grant_report_schedules_project
  ON public.grant_report_schedules(project_id);

-- RLS policies: reuse grants permissions
DROP POLICY IF EXISTS grant_report_schedules_select ON public.grant_report_schedules;
CREATE POLICY grant_report_schedules_select ON public.grant_report_schedules
  FOR SELECT
  USING (public.community_has_permission(project_id, 'grants', 'view'));

DROP POLICY IF EXISTS grant_report_schedules_insert ON public.grant_report_schedules;
CREATE POLICY grant_report_schedules_insert ON public.grant_report_schedules
  FOR INSERT
  WITH CHECK (public.community_has_permission(project_id, 'grants', 'create'));

DROP POLICY IF EXISTS grant_report_schedules_update ON public.grant_report_schedules;
CREATE POLICY grant_report_schedules_update ON public.grant_report_schedules
  FOR UPDATE
  USING (public.community_has_permission(project_id, 'grants', 'update'))
  WITH CHECK (public.community_has_permission(project_id, 'grants', 'update'));

DROP POLICY IF EXISTS grant_report_schedules_delete ON public.grant_report_schedules;
CREATE POLICY grant_report_schedules_delete ON public.grant_report_schedules
  FOR DELETE
  USING (public.community_has_permission(project_id, 'grants', 'delete'));
