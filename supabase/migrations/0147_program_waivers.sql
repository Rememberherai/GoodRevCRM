-- Program waivers: many-to-many link between programs and contract templates
-- Replaces the blind project-wide waiver template lookup with explicit per-program links

-- Join table: which contract templates are required waivers for which programs
CREATE TABLE IF NOT EXISTS public.program_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(program_id, template_id)
);

-- Per-enrollment per-waiver tracking
CREATE TABLE IF NOT EXISTS public.enrollment_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.program_enrollments(id) ON DELETE CASCADE,
  program_waiver_id UUID NOT NULL REFERENCES public.program_waivers(id) ON DELETE CASCADE,
  contract_document_id UUID REFERENCES public.contract_documents(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(enrollment_id, program_waiver_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_program_waivers_program_id ON public.program_waivers(program_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waivers_enrollment_id ON public.enrollment_waivers(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_waivers_contract_document_id ON public.enrollment_waivers(contract_document_id);

-- Updated_at triggers
CREATE TRIGGER set_program_waivers_updated_at
  BEFORE UPDATE ON public.program_waivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_enrollment_waivers_updated_at
  BEFORE UPDATE ON public.enrollment_waivers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-sync programs.requires_waiver from program_waivers rows
CREATE OR REPLACE FUNCTION public.sync_program_requires_waiver()
RETURNS TRIGGER AS $$
DECLARE
  target_program_id UUID;
BEGIN
  target_program_id := COALESCE(NEW.program_id, OLD.program_id);
  UPDATE public.programs
  SET requires_waiver = EXISTS(
    SELECT 1 FROM public.program_waivers WHERE program_id = target_program_id
  )
  WHERE id = target_program_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_program_requires_waiver
  AFTER INSERT OR DELETE ON public.program_waivers
  FOR EACH ROW EXECUTE FUNCTION public.sync_program_requires_waiver();

-- RLS
ALTER TABLE public.program_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_waivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS program_waivers_access ON public.program_waivers;
CREATE POLICY program_waivers_access ON public.program_waivers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.programs p
      WHERE p.id = program_id
        AND public.community_has_permission(p.project_id, 'programs', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.programs p
      WHERE p.id = program_id
        AND public.community_has_permission(p.project_id, 'programs', 'create')
    )
  );

DROP POLICY IF EXISTS enrollment_waivers_access ON public.enrollment_waivers;
CREATE POLICY enrollment_waivers_access ON public.enrollment_waivers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.program_waivers pw
      JOIN public.programs p ON p.id = pw.program_id
      WHERE pw.id = program_waiver_id
        AND public.community_has_permission(p.project_id, 'programs', 'view')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.program_waivers pw
      JOIN public.programs p ON p.id = pw.program_id
      WHERE pw.id = program_waiver_id
        AND public.community_has_permission(p.project_id, 'programs', 'create')
    )
  );
