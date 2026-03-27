-- Grant Answer Bank: project-scoped reusable narrative snippets for grant applications
CREATE TABLE IF NOT EXISTS public.grant_answer_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  usage_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS grant_answer_bank_project_id_idx ON public.grant_answer_bank(project_id);
CREATE INDEX IF NOT EXISTS grant_answer_bank_category_idx ON public.grant_answer_bank(project_id, category);

-- Full-text search index
CREATE INDEX IF NOT EXISTS grant_answer_bank_search_idx ON public.grant_answer_bank
  USING gin(to_tsvector('english', title || ' ' || content));

-- updated_at trigger
CREATE TRIGGER handle_updated_at_grant_answer_bank
  BEFORE UPDATE ON public.grant_answer_bank
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE public.grant_answer_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grant_answer_bank_project_access" ON public.grant_answer_bank
  USING (
    EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = grant_answer_bank.project_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_memberships pm
      WHERE pm.project_id = grant_answer_bank.project_id
        AND pm.user_id = auth.uid()
    )
  );
